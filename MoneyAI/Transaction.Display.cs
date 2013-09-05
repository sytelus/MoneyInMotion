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
            get { return this.UserCorrection.IfNotNull(u => u.EntityName) ?? this.EntityName; }
        }

        public string DisplayEntityName
        {
            get
            {
                var displayEntityName = this.UserCorrection.IfNotNull(u => u.EntityName) ?? this.EntityNameNormalized;
                if (displayEntityName == DisplayCategory)
                    return null;
                else return displayEntityName;
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
                    cachedDisplayCategoryPath = GetDisplayCategoryPath().ToArray();

                return cachedDisplayCategoryPath;
            }
        }

        public string cachedDisplayCategory;
        public string DisplayCategory
        {
            get
            {
                if (cachedDisplayCategory == null)
                    cachedDisplayCategory = string.Join(" > ", this.DisplayCategoryPath);

                return cachedDisplayCategory;
            }
        }

        private IEnumerable<string> GetDisplayCategoryPath()
        {
            if (!this.CategoryPath.IsNullOrEmpty())
                return this.CategoryPath;
            else
                return (this.UserCorrection.IfNotNull(c => c.EntityName) ?? this.EntityNameNormalized
                    ).AsEnumerable();
        }

    }
}
