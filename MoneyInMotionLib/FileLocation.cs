using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyInMotion
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
                this.ImportInfo = new ImportInfo()
                    {
                        UpdateDate = updateDate,
                        CreateDate = File.GetCreationTimeUtc(this.Address),
                        ContentHash = Utils.GetMD5HashString(string.Join("\t", fileRelativePath, updateDate.ToString("u"))),
                        PortableAddress = fileRelativePath
                    };
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
