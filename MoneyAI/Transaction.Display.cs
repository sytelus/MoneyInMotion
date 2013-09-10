using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public partial class Transaction
    {
        public string DisplayOriginalEntityName
        {
            get { return this.MergedEdits.IfNotNull(u => u.EntityName.IfNotNull(e => e.GetValueOrDefault())) ?? this.EntityName; }
        }

        public string DisplayEntityName
        {
            get
            {
                var displayEntityName = this.MergedEdits.IfNotNull(u => u.EntityName.IfNotNull(e => e.GetValueOrDefault()));
                return displayEntityName ?? this.EntityNameNormalized;
            }
        }

        public string DisplayEmpty
        {
            get { return string.Empty; }
        }

        public string DisplayIsUserFlaggedImageName
        {
            get
            {
                var isFlagged = this.MergedEdits.IfNotNull(u => u.IsFlagged.IfNotNull(e => e.GetValueOrDefault()));
                return isFlagged ? "flag" : null;
            }
        }

        public string DisplayAccountName
        {
            get { return this.AccountId; }
        }

        public string DisplayType
        {
            get { return this.TransactionReason.ToString(); }
        }

        public string DisplayImportInfo
        {
            get { return this.ImportId; }
        }

        private string[] cachedDisplayCategoryPath;
        public string[] DisplayCategoryPath
        {
            get
            {
                if (cachedDisplayCategoryPath == null)
                    cachedDisplayCategoryPath = GetDisplayCategoryPath();

                return cachedDisplayCategoryPath;
            }
        }

        private string cachedDisplayCategory;
        public string DisplayCategory
        {
            get
            {
                if (cachedDisplayCategory == null)
                    cachedDisplayCategory = string.Join(" > ", this.DisplayCategoryPath);

                return cachedDisplayCategory;
            }
        }

        private string[] GetDisplayCategoryPath()
        {
            var categoryPath = this.MergedEdits.IfNotNull(u => u.CategoryPath.IfNotNull(e => e.GetValueOrDefault()));
            return categoryPath ?? Utils.EmptyStringArray;
        }

    }
}
