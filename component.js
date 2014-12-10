"use strict";

var View = require("./View");
var makeEmitter = require("pubit-as-promised").makeEmitter;

module.exports = function mixinComponent(target, template) {
    var view = new View(template);
    var events = ["beforeRender", "render",
                  "beforeRefresh", "refresh",
                  "beforeDispose", "dispose",
                  "beforeDestroy", "destroy"];

    var publish = makeEmitter(target, events);

    target.option = function (key, value) {
        if (value === undefined) {
            return view.options[key];
        }

        view.options[key] = value;
        return target;
    };

    target.events = function () {
        events.push.apply(events, [].slice.call(arguments));
        return target;
    };

    target.mixins = function (mixin) {
        // All components come w/ showable mixin (Only supported mixin via option)
        // Next step is that mixins can be an arra
        function setDisplay(display, event) {
            if (target.element) {
                target.element.style.display = display;
                target.publish(event);
            }
        }

        if (mixin === "showable") {
            target.events("show", "hide");
            target.show = setDisplay.bind(target, "block", "show"); // Assume we are show block elements.
            target.hide = setDisplay.bind(target, "none", "hide");
        }

        return target;
    };

    target.render = function () {
        target.publish("beforeRender", view.options);
        target.element = view.render();
        target.publish("render", target.element);
        return target.element;
    };

    target.refresh = function () {
        var args = [].slice.call(arguments);
        args.push(view.options);

        target.publish.apply(target, ["beforeRefresh"].concat(args));

        return view.refresh().then(function (element) {
            target.element = element;
            target.publish.apply(target, ["refresh", element].concat(args));
            return element;
        });
    };

    target.region = function (region, renderable) {
        view.renderRegion(region, renderable);
        return target;
    };

    var on = target.on;
    target.on = function (event, handler) {
        on(event, handler.bind(target));
        return target;
    };

    target.dispose = function () {
        target.publish("beforeDispose", view.options);
        view.dispose();
        target.publish("dispose", view.options);
        return target;
    };

    target.destroy = function () {
        target.publish("beforeDestroy", view.options);
        view.destroy();
        target.publish("destroy", view.options);
        return target;
    };

    target.process = view.process;
    target.publish = publish;

    return target;
};
