using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web;
using System.IO;

namespace MoneyAI.WebApi.Models
{
    internal class TransactionCache
    {
        internal TransactionCache(string userId)
        {
            this.UserId = userId;
        }

        public Transactions Transactions { get; set; }
        public string SerializedJson { get; set; }
        public string UserId { get; private set; }

        public string GetDataPath()
        {
            return Path.Combine(AppDomain.CurrentDomain.GetData("DataDirectory").ToString(), this.UserId, "LatestMerged.json"); 
        }

        private static string GetDataPath(string userId)
        {
            return Path.Combine(AppDomain.CurrentDomain.GetData("DataDirectory").ToString(), userId, "LatestMerged.json"); 
        }

        public void Save()
        {
            this.EnsureSerializedJson();
            File.WriteAllText(this.GetDataPath(), this.SerializedJson);
        }

        internal void EnsureSerializedJson()
        {
            if (this.SerializedJson == null)
            {
                var dataPath = GetDataPath();

                var json = File.ReadAllText(dataPath);
                this.SerializedJson = json;
                this.Transactions = null;
            }
        }

        internal void EnsureTransactions()
        {
            var dataPath = GetDataPath();

            if (this.Transactions == null)
            {
                this.EnsureSerializedJson();
                this.Transactions = Transactions.DeserializeFromJson(this.SerializedJson);
            }
        }


        public static TransactionCache GetItem(string userId)
        {
            var dataPath = GetDataPath(userId);
            var cachedValue = HttpContext.Current.Cache[dataPath] as TransactionCache;
            if (cachedValue == null)
            {
                cachedValue = new TransactionCache(userId);
                HttpContext.Current.Cache.Insert(dataPath, cachedValue, new System.Web.Caching.CacheDependency(dataPath));
            }

            return cachedValue;
        }
    }
}