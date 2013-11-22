define("KeyCounter", [], function () {
    "use strict";
    return function (utils) {

        var $this = function KeyCounter(ignoreUndefinedKey) {
            this.ignoreUndefinedKey = ignoreUndefinedKey;
            this.keyCounts = new utils.Dictionary();
        };

        var proto = (function () {
            //privates


            //publics
            return {
                add: function (key) {
                    if (key !== undefined || !ignoreUndefinedKey) {
                        var newCount = (this.keyCounts.get(key) || 0) + 1;
                        this.keyCounts.set(newCount);
                    }
                },

                count: function () {
                    return this.keyCounts.size();
                },

                top: function () {
                    var maxKey, maxCount;

                    this.keyCounts.forEach(function (eachKey, eachCount) {
                        if (maxCount === undefined || maxCount < eachCount) {
                            maxKey = eachKey;
                            maxCount = eachCount;
                        }
                    });

                    return { key: maxKey, count: maxCount };
                },

                sorted: function (sortDescending) {
                    var array = this.keyCounts.toArray();
                    array.sort(utils.compareFunction(!!sortDescending, function (kvp) { return kvp.value; }));
                    return array;
                }

            };
        })();


        proto.constructor = $this;

        $this.prototype = proto;

        return $this;
    };
});