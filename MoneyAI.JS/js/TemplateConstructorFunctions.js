define("MyFunction", ["common/utils"], function (utils) {
    "use strict";

    //static privates
    var MyFunction = function () {
        utils.noop();
    };

    var myFunctionPrototype = (function () {
        //privates


        //publics
        return {
        };
    })();
    myFunctionPrototype.constructor = MyFunction;
    MyFunction.prototype = myFunctionPrototype;

    return MyFunction;
});