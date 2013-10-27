"use strict";

var View = require("./View");
var makeEmitter = require("pubit-as-promised").makeEmitter;

module.exports = function mixinComponent(target, template, viewModel) { 
    var view = new View(template);
    var publish = makeEmitter(target, ["beforeRender", "render"]);

    target.option = function (key, value) {
        if (value === undefined) {
            return view.options[key];
        }

        view.options[key] = value;
        return target;
    };

    target.render = function () {
        publish("beforeRender", view.options);
        target.element = view.render();
        publish("render", target.element);
        return target.element;
    };

    target.region = function (region, renderable) {
        view.renderRegion(region, renderable);
        return target;
    };

    var on = target.on;
    target.on = function (eventName, handler) {
        on(eventName, handler);
        return target;
    };
};