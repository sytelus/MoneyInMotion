﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]
    public class ImportInfo
    {
        [DataMember] public string PortableAddress { get; private set; }
        [DataMember] public DateTime UpdateDate { get; private set; }
        [DataMember] public DateTime CreateDate { get; private set; }
        [DataMember] public string ContentHash { get; private set; }
        [DataMember] public string Id { get; private set; }

        public ImportInfo(string id, string portableAddress, DateTime updateDate, DateTime createDate, string contentHash)
        {
            this.Id = id;
            this.PortableAddress = portableAddress;
            this.UpdateDate = updateDate;
            this.CreateDate = createDate;
            this.ContentHash = contentHash;
        }

        public static ImportInfo DeserializeFromJson(string serializedImportInfo)
        {
            return JsonSerializer<ImportInfo>.Deserialize(serializedImportInfo);
        }

        internal string SerializeToJson()
        {
            return JsonSerializer<ImportInfo>.Serialize(this);
        }
    }
}
