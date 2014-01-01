﻿define("common/globalEvents", [], function () {
   "use strict";

   return function (utils) {

       //Enable hashchange event for jslink anchors using delegated events
       utils.addEventHandler(undefined, "click", ".jslink  a[href^=#]", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
           var url = utils.dom(this).attr("href");
           utils.setUrlHash(url);
           event.preventDefault();
           event.stopPropagation();
       });

       //MoreOrLess panel handling
       utils.addEventHandler(undefined, "click", ".moreTrigger, .lessTrigger", function (event) {
           var trigger = utils.dom(this),
               moreOrLessPanel = trigger.closest(".moreOrLessPanel"),
               moreTriggerContainer = moreOrLessPanel.children(".moreTriggerContainer"),
               lessTriggerContainer = moreOrLessPanel.children(".lessTriggerContainer"),
               lessContentContainer = moreOrLessPanel.children(".lessContentContainer"),
               moreContentContainer = moreOrLessPanel.children(".moreContentContainer"),
               isMoreTrigger = trigger.hasClass("moreTrigger") && !trigger.hasClass("lessTrigger");

           moreTriggerContainer.toggle(!isMoreTrigger);
           moreContentContainer.toggle(isMoreTrigger);
           lessTriggerContainer.toggle(isMoreTrigger);
           lessContentContainer.toggle(!isMoreTrigger);

           event.preventDefault();
           event.stopPropagation();
       });

       //Checkbox group handling
       utils.addEventHandler(undefined, "click", ".checkboxGroupChecked", function (event) {
           var trigger = utils.dom(this),
               checkboxGroup = trigger.closest(".checkboxGroup"),
               checkBoxGroupOnCheckedPanel = checkboxGroup.children(".checkBoxGroupOnCheckedPanel"),
               checkBoxGroupOnUncheckedPanel = checkboxGroup.children(".checkBoxGroupOnUncheckedPanel"),
               isChecked = trigger.is(":checked");

           checkBoxGroupOnCheckedPanel.toggle(isChecked);
           checkBoxGroupOnUncheckedPanel.toggle(!isChecked);

           event.stopPropagation();
       });
   };

});