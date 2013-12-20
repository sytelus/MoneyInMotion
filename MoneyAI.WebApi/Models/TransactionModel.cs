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
            return cachedItem.SerializedJson;
        }

        public static int ApplyEdit(string userId, string serializedEdit)
        {
            var cachedItem = TransactionCache.GetItem(userId);

            var edit = TransactionEdit.DeserializeFromJson(serializedEdit);
            return cachedItem.ApplyEdit(edit);
        }
    }
}