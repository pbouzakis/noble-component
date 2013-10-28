"use strict";

var $ = require("jquery-browserify");
var View = require("./View");
var makeEmitter = require("pubit-as-promised").makeEmitter;

module.exports = function mixinComponent(target, template, viewModel) {
    var view = new View(template);
    var publish = makeEmitter(target, ["beforeRender", "render", "beforeRefresh", "refresh"]);

    target.model = function (model) {
        if (model === undefined) {
            return view.options.model;
        }

        view.options.model = model;
        return target;
    };

    target.option = function (key, value) {
        if (value === undefined) {
            return view.options[key];
        }

        view.options[key] = value;
        return target;
    };

    target.mixins = function (mixin) {
        // All components come w/ showable mixin (Only supported mixin via option)
        // Next step is that mixins can be an array
        if (mixin === "showable") {
            target.show = function () {
                $(target.element).show();
            };

            target.hide = function () {
                $(target.element).hide();
            };
        }

        return target;
    };

    target.render = function () {
        publish("beforeRender", view.options);
        target.element = view.render();
        publish("render", target.element);
        return target.element;
    };

    target.refresh = function () {
        var args = [].slice.call(arguments);
        args.unshift("beforeRefresh");
        args.push(view.options);

        publish.apply(target, args);

        return view.refresh().then(function (element) {
            publish("refresh", element);
        });
    }

    target.region = function (region, renderable) {
        view.renderRegion(region, renderable);
        return target;
    };

    var on = target.on;
    target.on = function (eventName, handler) {
        on(eventName, handler.bind(target));
        return target;
    };

    return target;
};
