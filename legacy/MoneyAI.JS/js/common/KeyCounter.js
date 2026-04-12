define("common/keyCounter", [], function () {
    "use strict";
    return function (utils) {

        var $this = function KeyCounter(ignoreUndefinedKey, keyMapFunction) {
            this.ignoreUndefinedKey = ignoreUndefinedKey;
            this.keyMapFunction = keyMapFunction;
            this.keyCounts = {};
            this.count = 0;
            this.missedCount = 0;
            this.notMissedCount = 0;
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

                        this.notMissedCount++;
                    }
                    else {
                        this.missedCount++;
                    }

                    this.count++;
                },

                getKeyCount: function () {
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
                    this.keyCount = this.getKeyCount();
                    this.top = this.getTop();
                    this.allSame = this.notMissedCount === this.count && this.keyCount === 1;
                }
            };
        })();

        //class statics
        $this.booleanKeyMap = function (value) {
            if (value === undefined) {
                return undefined;
            }
            else {
                var boolValue = !!value;
                return boolValue === true ? "trueValue" : (boolValue === false ? "falseValue" : undefined);
            }
        };

        proto.constructor = $this;

        $this.prototype = proto;

        return $this;
    };
});