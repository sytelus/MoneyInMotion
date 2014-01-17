using System;
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

        private static string GetEntityNameNormalized(string entityName)
        {
            return EntityNameNormalizer.Normalize(entityName);
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
