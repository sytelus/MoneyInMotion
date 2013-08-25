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
        public ContentType ContentType { get; private set; }
        public AccountConfig AccountConfig { get; private set; }

        private readonly string fileRelativePath;
        private readonly DateTime? fileModifiedDateTime;
        private readonly Lazy<string> contentHashLazy;
        
        private string GetFileContentHash()
        {
            if (fileModifiedDateTime == null)
                throw new Exception("Cannot get ContentHash if fileModifiedDateTime was not supplied");

            return Utils.GetMD5HashString(string.Join("\t", fileRelativePath, fileModifiedDateTime.Value.ToString("u")));
        }

        public FileLocation(string rootPath, string relativeFilePath, AccountConfig accountConfig = null, bool enableContentHash = false)
        {
            this.Address = Path.Combine(rootPath, relativeFilePath);
            fileRelativePath = relativeFilePath;
            
            this.fileModifiedDateTime = enableContentHash ? (DateTime?)File.GetLastWriteTimeUtc(this.Address) : null;
            this.AccountConfig = accountConfig;

            contentHashLazy = new Lazy<string>(GetFileContentHash);
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

        public string ContentHash { get { return contentHashLazy.Value; } }
    }
}
