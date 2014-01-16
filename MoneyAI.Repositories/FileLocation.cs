using System;
using System.IO;
using CommonUtils;

namespace MoneyAI.Repositories
{
    public class FileLocation : ILocation
    {
        public string Address { get; private set; }
        public string PortableAddress { get; private set; }
        public ImportInfo ImportInfo { get; private set; }
        public ContentType ContentType { get; private set; }
        public AccountConfig AccountConfig { get; private set; }

        public FileLocation(string rootPath, string relativeFilePath, AccountConfig accountConfig = null, bool isImportInfo = false)
        {
            this.Address = Path.Combine(rootPath, relativeFilePath);
            this.PortableAddress = relativeFilePath;
            var extention = Path.GetExtension(Address).ToUpperInvariant();

            if (isImportInfo)
            {
                var updateDate = File.GetLastWriteTimeUtc(this.Address);
                var importId = Utils.GetMD5HashString(string.Join("\t", relativeFilePath), true);
                this.ImportInfo = new ImportInfo(importId, relativeFilePath, updateDate, File.GetCreationTimeUtc(this.Address), importId, extention);
            }
            this.AccountConfig = accountConfig;

            switch (extention)
            {
                case ".CSV":
                    ContentType = ContentType.Csv;
                    break;
                case ".JSON":
                    ContentType = ContentType.Json;
                    break;
                case ".IIF":
                    ContentType = ContentType.QuickBooksIif;
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
