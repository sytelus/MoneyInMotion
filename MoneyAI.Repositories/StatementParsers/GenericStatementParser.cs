using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using MoneyAI.Repositories.FileFormatParsers;

namespace MoneyAI.Repositories.StatementParsers
{
    public class GenericStatementParser : StatementParserBase
    {
        IFileFormatParser fileFormatParser;
        public GenericStatementParser(string filePath, string[] allowedFileExtentions, Settings fileFormatParserSettings = null)
        {
            var fileExtension = ValidateFilePath(filePath, allowedFileExtentions);

            switch(fileExtension)
            {
                case ".csv":
                    fileFormatParser = CreateFileFormatParser<CsvFileParser>(filePath, fileFormatParserSettings);
                    break;
                case ".json":
                    fileFormatParser = CreateFileFormatParser<JsonFileParser>(filePath, fileFormatParserSettings);
                    break;
                case ".iif":
                    fileFormatParser = CreateFileFormatParser<IifFileParser>(filePath, fileFormatParserSettings);
                    break;
                default:
                    throw new NotSupportedException("Cannot parse statement because extention {0} is not supported for file {1}".FormatEx(fileExtension, filePath));
            }
        }

        protected virtual IFileFormatParser CreateFileFormatParser<T>(string filePath, Settings fileFormatParserSettings) where T : IFileFormatParser, new()
        {
            var parser = new T();
            parser.Initialize(filePath, fileFormatParserSettings);
            return parser;
        }

        private static string ValidateFilePath(string filePath, string[] allowedFileExtentions)
        {
            var fileExtension = Path.GetExtension(filePath).ToLowerInvariant();
            if (allowedFileExtentions != null && !allowedFileExtentions.Contains(fileExtension))
                throw new NotSupportedException("File extention is not supported, file {0} cannot be parsed".FormatEx(filePath));

            return fileExtension;
        }

        protected override IEnumerable<IEnumerable<KeyValuePair<string, string>>> GetTransactionProperties()
        {
            return fileFormatParser.GetTransactionProperties();
        }
    }
}
