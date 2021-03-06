#!/usr/bin/env node
'use strict';
var _ = require('lodash');
var chalk = require('chalk');
var eachAsync = require('each-async');
var multiline = require('multiline');
var nopt = require('nopt');
var updateNotifier = require('update-notifier');
var stdin = require('get-stdin');
var subarg = require('subarg');
var sudoBlock = require('sudo-block');
var Pageres = require('./');
var notifier = updateNotifier();

var options = nopt({
	help: Boolean,
	version: Boolean,
	crop: Boolean,
	delay: Number
}, {
	h: '--help',
	v: '--version',
	c: '--crop',
	d: '--delay'
});

var args = subarg(options.argv.remain)._;

function showHelp() {
	console.log(multiline.stripIndent(function () {/*
		Get screenshots of websites in different resolutions.

		Specify urls and screen resolutions as arguments. Order doesn't matter. Group arguments with [ ]
		Screenshots are saved in the current directory.

		Usage
		  pageres <url> <resolution>
		  pageres [ <url> <resolution> ] [ <url> <resolution> ]
		  pageres [ <url> <resolution> ... ] < <file>
		  cat <file> | pageres [ <url> <resolution> ... ]

		Example
		  pageres todomvc.com yeoman.io 1366x768 1600x900
		  pageres [ yeoman.io 1366x768 1600x900 ] [ todomvc.com 1024x768 480x320 ]
		  pageres --delay 3 1366x768 < urls.txt
		  pageres unicorn.html 1366x768
		  cat screen-resolutions.txt | pageres todomvc.com yeoman.io

		Options
		  -d, --delay <seconds>    Delay capturing the screenshot
		  -c, --crop               Crop to the set height

		<url> can also be a local file path.

		You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments. If no screen resolutions are specified it will fall back to the ten most popular ones according to w3counter.
	*/}));
}

function generate(args, opts) {
	var pageres = new Pageres(opts)
		.dest(process.cwd());

	args.forEach(function (arg) {
		pageres.src(arg.url, arg.sizes);
	});

	pageres.run(function (err) {
		if (err) {
			if (err instanceof Error) {
				throw err;
			} else {
				console.error(err);
				process.exit(1);
			}
		}

		var i = pageres.sizes.length;
		var s = pageres.stats.screenshots;
		var u = pageres.stats.urls;

		console.log(chalk.green('\n✔') + ' Successfully generated %d screenshots from %d %s and %d %s', i, u, (u === 1 ? 'url' : 'urls'), s, (s === 1 ? 'resolution': 'resolutions'));
	});
}

function get(args, options, cb) {
	var ret = [];

	eachAsync(args, function (arg, i, next) {
		if (arg.url.length === 0) {
			console.error(chalk.yellow('Specify a url'));
			return showHelp();
		}

		if (arg.sizes.length === 0 && arg.keywords.length === 0) {
			console.log('No sizes specified. Falling back to the ten most popular screen resolutions according to w3counter.');
		}

		if (arg.keywords.length > 0) {
			arg.sizes = arg.sizes.concat(arg.keywords);
		}

		arg.url.forEach(function (el) {
			ret.push({ url: el, sizes: arg.sizes });
		});

		next();
	}, function (err) {
		if (err) {
			cb(err);
		}

		cb(null, ret);
	});
}

function parse(args) {
	var ret = [];

	args.forEach(function (arg) {
		arg = arg._;

		var url = _.uniq(arg.filter(/./.test, /\.|localhost/));
		var sizes = _.uniq(arg.filter(/./.test, /^\d{3,4}x\d{3,4}$/i));
		var keywords = _.difference(arg, url.concat(sizes));

		ret.push({ url: url, sizes: sizes, keywords: keywords });
	});

	return ret;
}

function init(args, options) {
	if (options.help || args.length === 0) {
		return showHelp();
	}

	if (options.version) {
		return console.log(require('./package').version);
	}

	if (args.some(function (arr) { return arr._ === undefined; })) {
		args = [{ _: args }];
	}

	get(parse(args), options, function (err, items) {
		if (err) {
			throw err;
		}

		generate(items, options);
	});
}

if (notifier.update) {
	notifier.notify(true);
}

sudoBlock();

if (process.stdin.isTTY) {
	init(args, options);
} else {
	stdin(function (data) {
		[].push.apply(args, data.trim().split('\n'));
		init(args, options);
	});
}
