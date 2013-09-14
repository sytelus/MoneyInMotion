using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CommonUtils;

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

        private string cachedEntityNameNormalized = null;
        public string EntityNameNormalized
        {
            get
            {
                if (cachedEntityNameNormalized == null)
                    cachedEntityNameNormalized = GetEntityNameNormalized(this.EntityName) ?? string.Empty;

                return cachedEntityNameNormalized;
            }
        }

        private readonly static Regex nonAlphaRegex = new Regex(@"[^\w\s\.]|[\d]", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex multipleWhiteSpaceRegex = new Regex(@"[\s]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex whiteSpaceRegex = new Regex(@"[\s]", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static string GetEntityNameNormalized(string entityName)
        {
            //Ensure non-null name
            entityName = entityName ?? string.Empty;
            //Replace non-alpha chars with space
            var cleanedName = nonAlphaRegex.Replace(entityName, " ");
            //Replace white spaces such as tab/new lines with space
            cleanedName = multipleWhiteSpaceRegex.Replace(cleanedName, " ");
            //Combine multiple spaces to one
            cleanedName = whiteSpaceRegex.Replace(cleanedName, " ");
            //Trim extra spaces
            cleanedName = cleanedName.Trim();

            //Determine if we should convert to title case or lower case
            var hasAnyUpperCase = cleanedName.Any(Char.IsUpper);
            var hasAnyLowerCase = cleanedName.Any(Char.IsLower);
            //If mixed case then skip case conversion
            if (!(hasAnyLowerCase && hasAnyUpperCase))
            {
                var isAllUpperCase = !hasAnyLowerCase && cleanedName.All(c => Char.IsUpper(c) || !char.IsLetter(c));
                var hasDot = cleanedName.Contains('.'); //Posible .com names
                if (isAllUpperCase)
                    cleanedName = !hasDot ? cleanedName.ToTitleCase() : cleanedName.ToLower();
            }

            if (cleanedName.Length == 0)
                cleanedName = entityName.Trim().ToTitleCase();

            return cleanedName;
        }


        public string DisplayEmpty
        {
            get { return string.Empty; }
        }

        public string DisplayIsUserFlaggedImageName
        {
            get
            {
                var isFlagged = this.MergedEdit.IfNotNull(u => u.IsFlagged.IfNotNull(e => e.GetValueOrDefault()));
                return isFlagged ? "flag" : null;
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
                    cachedCategoryPath = this.MergedEdit.IfNotNull(u => u.CategoryPath.IfNotNull(e => e.GetValueOrDefault())) ?? Utils.EmptyStringArray;

                return cachedCategoryPath;
            }
        }

        private string cachedDisplayCategory;
        public string DisplayCategory
        {
            get
            {
                if (cachedDisplayCategory == null)
                    cachedDisplayCategory = string.Join(" > ", this.CategoryPath.IfNullOrEmpty(() => this.DisplayEntityNameNormalized.AsArray()));

                return cachedDisplayCategory;
            }
        }
    }
}
