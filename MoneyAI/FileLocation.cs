using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public class FileLocation : ILocation
    {
        public string Address { get; private set; }
        public ImportInfo ImportInfo { get; private set; }
        public ContentType ContentType { get; private set; }
        public AccountConfig AccountConfig { get; private set; }

        private readonly string fileRelativePath;
        
        public FileLocation(string rootPath, string relativeFilePath, AccountConfig accountConfig = null, bool isImportInfo = false)
        {
            this.Address = Path.Combine(rootPath, relativeFilePath);
            fileRelativePath = relativeFilePath;

            if (isImportInfo)
            {
                var updateDate = File.GetLastWriteTimeUtc(this.Address);
                var importId = Utils.GetMD5HashString(string.Join("\t", fileRelativePath, updateDate.ToString("u")));
                this.ImportInfo = new ImportInfo(importId, relativeFilePath, updateDate, File.GetCreationTimeUtc(this.Address), importId);
            }
            this.AccountConfig = accountConfig;

            var extention = Path.GetExtension(Address).ToUpperInvariant();
            switch (extention)
            {
                case ".CSV":
                    ContentType = ContentType.Csv;
                    break;
                case ".JSON":
                    ContentType = ContentType.Json;
                    break;
                case null:
                case ".":
                case "":
                    ContentType = ContentType.None;
                    break;
                default:
                    throw new ArgumentException("File extention {0} is not supported for file {1}".FormatEx(extention, Address), "relativeFilePath");
            }
        }
    }
}
