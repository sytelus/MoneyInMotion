using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.IO;
using CommonUtils;

namespace MoneyInMotion
{
    public class DiskTransactionRepository : ITransactionsRepository
    {
        private readonly string rootFolderPath, importFolderPath, namedTransactionsFolderPath, namedLocationsFilePath;
        private readonly IDictionary<string, ILocation> namedLocations;

        const string DefaultRelativeDropBoxFolder = "WalletWolf", DefaultRelativeImportFolder = "Statements", DefaultRelativeNamedTransactionsFolder = "Merged"
            , DefaultLatestMergedFileName = "LatestMerged.json", DropBoxHostFileName = "Dropbox\\host.db";
        const string AccountConfigFileName = @"AccountConfig.json", NamedLocationsFileName = @"NamedLocations.json";

        public DiskTransactionRepository(string rootFolderPath = null)
        {
            this.rootFolderPath = rootFolderPath ?? Path.Combine(GetDropBoxPath(), DefaultRelativeDropBoxFolder);

            importFolderPath = Path.Combine(this.rootFolderPath, DefaultRelativeImportFolder);
            namedTransactionsFolderPath = Path.Combine(this.rootFolderPath, DefaultRelativeNamedTransactionsFolder);

            namedLocationsFilePath = Path.Combine(namedTransactionsFolderPath, NamedLocationsFileName);
            namedLocations = File.Exists(namedLocationsFilePath)
                ? Utils.DeserializeDictionaryFromJson<string, ILocation>(File.ReadAllText(namedLocationsFilePath)).ToDictionary()
                : new Dictionary<string, ILocation>()
                {
                    { LastestMergedTransactionsName, new FileLocation(namedTransactionsFolderPath, DefaultLatestMergedFileName) }
                } ;
        }

        public string RootFolderPath
        {
            get { return rootFolderPath; }
        }

        public string LastestMergedTransactionsName
        {
            get { return DefaultLatestMergedFileName; }
        }

        private static string GetDropBoxPath()
        {
            var appDataPath = Environment.GetFolderPath(
                                               Environment.SpecialFolder.ApplicationData);
            var dbPath = Path.Combine(appDataPath, DropBoxHostFileName);

            if (!File.Exists(dbPath))
                return null;

            var lines = File.ReadAllLines(dbPath);
            var dbBase64Text = Convert.FromBase64String(lines[1]);
            var folderPath = Encoding.ASCII.GetString(dbBase64Text);

            return folderPath;
        }

        public IEnumerable<ILocation> GetStatementLocations(ILocation startLocation = null, AccountConfig parentAccountConfig = null)
        {
            startLocation = startLocation ?? new FileLocation(rootFolderPath, DefaultRelativeImportFolder);

            var accountConfigFilePath = Path.Combine(startLocation.Address, AccountConfigFileName);
            
            AccountConfig accountConfig;
            if (File.Exists(accountConfigFilePath))
                accountConfig = AccountConfig.DeserializeFromJson(File.ReadAllText(accountConfigFilePath));
            else
                accountConfig = parentAccountConfig;

            if (accountConfig != null)
            {
                foreach (var fileFilter in accountConfig.FileFilters)
                {
                    var fileNames = Directory.EnumerateFiles(startLocation.Address, fileFilter,
                        SearchOption.TopDirectoryOnly);
                    foreach (var fileName in fileNames)
                        yield return new FileLocation(startLocation.Address, fileName, accountConfig, true);
                }
            }

            if (accountConfig == null || accountConfig.ScanSubFolders)
            {
                foreach (var subFolderName in Directory.EnumerateDirectories(startLocation.Address))
                    foreach (var subLocation in GetStatementLocations(new FileLocation(startLocation.Address, subFolderName), accountConfig))
                        yield return subLocation;
            }
        }

        
        public ILocation GetNamedLocation(string name)
        {
            return namedLocations[name];
        }

        public void SaveNamedLocation(string name, ILocation location)
        {
            namedLocations[name] = location;
            File.WriteAllText(namedLocationsFilePath, Utils.SerializeToJson(namedLocations));
        }

        public bool NamedLocationExists(string name)
        {
            return namedLocations.ContainsKey(name);
        }

        public IEnumerable<KeyValuePair<string, ILocation>> NamedLocations
        {
            get { return namedLocations; }
        }

        public Transactions Load(ILocation location)
        {
            switch (location.ContentType)
            {
                case ContentType.Csv:
                    var transactionsFromFile = GetTransactionsFromCsvFile(location.Address, location.AccountConfig.AccountInfo, location.ImportInfo).ToList();
                    return new Transactions(transactionsFromFile);
                case ContentType.Json:
                    var jsonLines = File.ReadLines(location.Address);
                    return Transactions.DeserializeFromJson(jsonLines);
                case ContentType.None:
                default:
                    throw new ArgumentException("location.ContentType value {0} is not supported for loading transaction".FormatEx(location.ContentType));
            }
            
            
        }

        private static IEnumerable<Transaction> GetTransactionsFromCsvFile(string file, AccountInfo accountInfo, ImportInfo importInfo)
        {
            var lines = File.ReadAllLines(file).RemoveNullOrEmpty();
            var headerColumns = (string[])null;
            foreach (var line in lines)
            {
                if (headerColumns == null)
                    headerColumns = Utils.ParseCsvLine(line).ToArray();
                else
                {
                    var transaction = Transaction.CreateFromCsvLine(headerColumns, line, accountInfo, importInfo);
                    yield return transaction;
                }
            }
        }
        
        public void Save(Transactions transactions, ILocation location)
        {
            using (var textFileWriter = File.CreateText(location.Address))
            {
                foreach (var transactionSerialized in transactions.SerializeToJson())
                    textFileWriter.WriteLine(transactionSerialized);
            }
        }

        public bool TransactionsExists(ILocation location)
        {
            return File.Exists(location.Address);
        }


        public void AddAccountConfig(AccountConfig accountConfig)
        {
            var accountFolder = Path.Combine(this.importFolderPath, accountConfig.AccountInfo.Id);
            if (!Directory.Exists(accountFolder))
                Directory.CreateDirectory(accountFolder);

            var accountConfigFilePath = Path.Combine(accountFolder, AccountConfigFileName);

            if (File.Exists(accountConfigFilePath))
                throw new Exception("Account config file {0} already exist. Cannot add new account.".FormatEx(accountConfigFilePath));

            File.WriteAllText(accountConfigFilePath, accountConfig.SerializeToJson());
        }
    }
}
