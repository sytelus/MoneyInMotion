using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.Globalization;
using System.IO;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;

namespace MoneyAI.Repositories
{
    internal class JsonTransactionFileParser : StatementParserBase
    {
        public class Settings
        {
            public HashSet<string> IgnoreColumns { get; set; }
        }

        private string filePath;
        private Settings settings;
        public JsonTransactionFileParser(string filePath, Settings settings = null)
        {
            this.filePath = filePath;
            this.settings = settings == null ? new Settings() : settings;
        }

        protected override IEnumerable<IEnumerable<KeyValuePair<string, string>>> GetTransactionProperties()
        {
            JArray itemsJson = this.ParseJson();

            foreach (var jArrayItem in itemsJson)
            {
                if (jArrayItem.Type == JTokenType.Object)
                {
                    var kvp = ((JObject)jArrayItem).Properties()
                        .Select(itemProperty =>  itemProperty)
                        .Select(itemProperty => this.GetKvpFromProperty(itemProperty));

                    yield return kvp;
                }
            }
        }

        private KeyValuePair<string, string> GetKvpFromProperty(JProperty itemProperty)
        {
            var propertyName = itemProperty.Name;
            if (this.settings.IgnoreColumns != null && this.settings.IgnoreColumns.Contains(propertyName))
                propertyName = "_" + propertyName;  //Ignored properties will be added to ProviderAttributes

            string propertyValueString;
            this.TransformPropertyValue(ref propertyName, itemProperty.Value, out propertyValueString);

            return new KeyValuePair<string, string>(propertyName, propertyValueString);
        }

        protected virtual void TransformPropertyValue(ref string propertyName, JToken propertyValueToken, out string propertyValueString)
        {
            propertyValueString = propertyValueToken.ToString();
        }

        protected virtual JArray ParseJson()
        {
            using (var fileReader = File.OpenText(this.filePath))
            {
                return (JArray) JToken.ReadFrom(new JsonTextReader(fileReader));
            }
        }
    }
}
