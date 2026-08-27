using System;
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
        [DataMember(IsRequired = true)] 
        public string PortableAddress { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public DateTime? UpdateDate { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public DateTime? CreateDate { get; private set; }

        [DataMember(IsRequired = true)]
        public string ContentHash { get; private set; }

        [DataMember(IsRequired = true)]
        public string Id { get; private set; }

        [DataMember(IsRequired = true)]
        public string Format { get; private set; }

        public ImportInfo(string id, string portableAddress, DateTime? updateDate, DateTime? createDate, string contentHash, string format)
        {
            this.Id = id;
            this.PortableAddress = portableAddress;
            this.UpdateDate = updateDate;
            this.CreateDate = createDate;
            this.ContentHash = contentHash;
            this.Format = format;
        }

        public static ImportInfo DeserializeFromJson(string serializedData)
        {
            return JsonSerializer<ImportInfo>.Deserialize(serializedData);
        }

        internal string SerializeToJson()
        {
            return JsonSerializer<ImportInfo>.Serialize(this);
        }
    }
}
