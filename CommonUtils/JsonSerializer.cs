using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Runtime.Serialization.Json;

namespace CommonUtils
{
    public static class JsonSerializer<T> where T:class
    {
        private static DataContractJsonSerializer serializer = new DataContractJsonSerializer(typeof(T)); 

        public static string Serialize(T objectGraph)
        {
            return Utils.SerializeToJson(serializer, objectGraph);
        }

        public static T Deserialize(string serializedObjectGraph)
        {
            return Utils.DeserializeFromJson<T>(serializer, serializedObjectGraph);
        }
    }
}
