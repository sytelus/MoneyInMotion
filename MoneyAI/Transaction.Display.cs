﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CommonUtils;
using System.Diagnostics;

namespace MoneyAI
{
    public partial class Transaction
    {
        public string DisplayEntityNameOriginal
        {
            get { return this.CorrectedEntityName ?? this.EntityName; }
        }

        public string DisplayEntityNameNormalized
        {
            get { return this.CorrectedEntityName ?? this.EntityNameNormalized; }
        }

        public string CorrectedEntityName
        {
            get { return this.MergedEdit.IfNotNull(u => u.EntityName.IfNotNull(e => e.GetValueOrDefault())); }
        }

        /* Normalization rules
         * Remove any stand-alone word made up only of non-alpha symbols of size > 3 
         * Collapse multiple whitespaces to 1
         * Title case.
         */
        private readonly static Regex nonAlphaLongWords = new Regex(@"\b([\p{P}\d\#]){3,}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex punctuationAtStart = new Regex(@"\b[\p{P}\#-[\.\'\-\:\,\\\/\%\@\(\)]]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex punctuationAtEnd = new Regex(@"[\p{P}\#-[\.\'\-\:\,\\\/\%\@\(\)]]+\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex multipleWhiteSpaceRegex = new Regex(@"[\s]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static string GetEntityNameNormalized(string entityName)
        {
            //Ensure non-null name
            var cleanedName = entityName ?? string.Empty;

            if (cleanedName.IndexOf("walgreens", StringComparison.CurrentCultureIgnoreCase) >= 0)
                Debugger.Break();

            //Replace non-alpha chars with space
            cleanedName = nonAlphaLongWords.Replace(cleanedName, " ");
            cleanedName = punctuationAtStart.Replace(cleanedName, " ");
            cleanedName = punctuationAtEnd.Replace(cleanedName, " ");

            //Combine multiple spaces to one
            cleanedName = multipleWhiteSpaceRegex.Replace(cleanedName, " ");

            //Trim extra spaces
            cleanedName = cleanedName.Trim();

            //Determine if we should convert to title case or lower case
            var hasAnyUpperCase = cleanedName.Any(Char.IsUpper);
            var hasAnyLowerCase = cleanedName.Any(Char.IsLower);
            //If mixed case then skip case conversion
            if (!(hasAnyLowerCase && hasAnyUpperCase))
            {
                var isAllUpperCase = !hasAnyLowerCase && cleanedName.All(c => Char.IsUpper(c) || !char.IsLetter(c));
                var hasDot = cleanedName.IndexOf('.') > 1; //Posible .com names
                if (isAllUpperCase)
                    cleanedName = !hasDot ? cleanedName.ToTitleCase() : cleanedName.ToLower();
            }

            if (cleanedName.Length == 0)
                cleanedName = entityName.Trim();

            return cleanedName;
        }


        public string DisplayEmpty
        {
            get { return string.Empty; }
        }

        public bool? IsUserFlagged
        {
            get
            {
                var isFlaggedEditValue = this.MergedEdit.IfNotNull(u => u.IsFlagged);
                if (isFlaggedEditValue == null)
                    return null;
                else return isFlaggedEditValue.GetValueOrDefault(); 
            }
        }

        public string Note
        {
            get { return this.MergedEdit.IfNotNull(u => u.Note.IfNotNull(e => e.GetValueOrDefault())); }
        }

        public string DisplayRowImageName
        {
            get
            {
                if (this.IsUserFlagged.IsTrue())
                    return "flag";
                else if (this.Note != null)
                    return "note";
                if (this.IsUserFlagged.IsFalse())
                    return "unFlag";
                else
                    return null;
            }
        }

        //TODO: Get real account name
        public string DisplayAccountName
        {
            get { return this.AccountId; }
        }

        //TODO: Get real account name
        public string DisplayImportInfo
        {
            get { return this.ImportId; }
        }
        
        public string DisplayType
        {
            get { return this.TransactionReason.ToString(); }
        }

        private string[] cachedCategoryPath;
        public string[] CategoryPath
        {
            get
            {
                if (cachedCategoryPath == null)
                    cachedCategoryPath = GetCategoryPath() ?? Utils.EmptyStringArray;

                return cachedCategoryPath;
            }
        }

        private string[] GetCategoryPath()
        {
            return this.MergedEdit.IfNotNull(u => u.CategoryPath.IfNotNull(e => e.GetValueOrDefault()));
        }

        private DateTime? cachedCorrectedTransactionDate;
        public DateTime CorrectedTransactionDate
        {
            get
            {
                if (cachedCorrectedTransactionDate == null)
                    cachedCorrectedTransactionDate = this.MergedEdit.IfNotNull(u => u.TransactionDate.IfNotNull(e => e.Value, this.TransactionDate)
                        , this.TransactionDate);

                return cachedCorrectedTransactionDate.Value;
            }
        }

        private string[] cachedDisplayCategoryPathOrName;
        public string[] DisplayCategoryPathOrName
        {
            get
            {
                if (cachedDisplayCategoryPathOrName == null)
                    cachedDisplayCategoryPathOrName = GetCategoryPath() ?? this.DisplayEntityNameNormalized.AsArray();

                return cachedDisplayCategoryPathOrName;
            }
        }


        private string cachedDisplayCategory;
        public string DisplayCategoryPathOrNameCocatenated
        {
            get
            {
                if (cachedDisplayCategory == null)
                    cachedDisplayCategory = string.Join(" > ", this.CategoryPath.IfNullOrEmpty(() => this.DisplayEntityNameNormalized.AsArray()));

                if (string.IsNullOrWhiteSpace(cachedDisplayCategory))
                    Debugger.Break();

                return cachedDisplayCategory;
            }
        }
    }
}
