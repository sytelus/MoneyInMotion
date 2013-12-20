using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace MoneyAI.WebApi.Models
{
    public class TransactionModel
    {
        public static string GetSerializedJson(string userId)
        {
            var cachedItem = TransactionCache.GetItem(userId);
            cachedItem.EnsureSerializedJson();
            return cachedItem.SerializedJson;
        }

        public static int ApplyEdit(string userId, string serializedEdit)
        {
            var cachedItem = TransactionCache.GetItem(userId);
            cachedItem.EnsureTransactions();

            var edit = TransactionEdit.DeserializeFromJson(serializedEdit);
            var affectedTransactions = cachedItem.Transactions.Apply(edit, false).Count();
            cachedItem.SerializedJson = cachedItem.Transactions.SerializeToJson();
            cachedItem.Save();

            return affectedTransactions;
        }
    }
}