define("common/keyCounter", [], function () {
    "use strict";
    return function (utils) {

        var $this = function KeyCounter(ignoreUndefinedKey, keyMapFunction) {
            this.ignoreUndefinedKey = ignoreUndefinedKey;
            this.keyMapFunction = keyMapFunction;
            this.keyCounts = {};
        };

        var proto = (function () {
            //privates


            //publics
            return {
                add: function (key) {
                    if (this.keyMapFunction) {
                        key = this.keyMapFunction(key);
                    }

                    if (key !== undefined || !this.ignoreUndefinedKey) {
                        var newCount = (this.keyCounts[key] || 0) + 1;
                        this.keyCounts[key] = newCount;
                    }
                },

                getCount: function () {
                    return utils.size(this.keyCounts);
                },

                getTop: function () {
                    var maxKey, maxCount;

                    utils.forEach(this.keyCounts, function (eachCount, eachKey) {
                        if (maxCount === undefined || maxCount < eachCount) {
                            maxKey = eachKey;
                            maxCount = eachCount;
                        }
                    });

                    return { key: maxKey, count: maxCount };
                },

                getSorted: function (sortDescending) {
                    var array = utils.toKeyValueArray(this.keyCounts);
                    array.sort(utils.compareFunction(!!sortDescending, function (kvp) { return kvp.value; }));
                    return array;
                },

                finalize: function() {
                    this.count = this.getCount();
                    this.top = this.getTop();
                },

                booleanKeyMap: function() {
                    return function (boolValue) { return boolValue ? "trueValue" : "falseValue"; };
                }
            };
        })();


        proto.constructor = $this;

        $this.prototype = proto;

        return $this;
    };
});