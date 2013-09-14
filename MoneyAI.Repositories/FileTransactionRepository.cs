using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyAI.Repositories
{
    public class FileTransactionRepository : ITransactionsRepository
    {
        private readonly string rootFolderPath, importFolderPath, namedLocationsFilePath;
        private readonly IDictionary<string, ILocation> namedLocations;
        private readonly IStorageOperations<Transactions> transactionsStorage = new TransactionsStorageOperations();
        private readonly IStorageOperations<TransactionEdits> transactionEditsStorage = new TransactionEditsStorageOperations();

        const string DefaultRelativeDropBoxFolder = "MoneyAI", DefaultRelativeImportFolder = "Statements", DefaultRelativeNamedTransactionsFolder = "Merged"
            , DefaultLatestMergedFileName = "LatestMerged.json", DefaultTransactionEditsFileName = "TransactionEdits.json"
            , DropBoxHostFileName = "Dropbox\\host.db";
        const string AccountConfigFileName = @"AccountConfig.json", NamedLocationsFileName = @"NamedLocations.json";

        public FileTransactionRepository(string rootFolderPath = null)
        {
            this.rootFolderPath = rootFolderPath ?? Path.Combine(GetDropBoxPath(), DefaultRelativeDropBoxFolder);

            importFolderPath = Path.Combine(this.rootFolderPath, DefaultRelativeImportFolder);
            var namedTransactionsFolderPath = Path.Combine(this.rootFolderPath, DefaultRelativeNamedTransactionsFolder);

            namedLocationsFilePath = Path.Combine(namedTransactionsFolderPath, NamedLocationsFileName);
            namedLocations = File.Exists(namedLocationsFilePath)
                ? Utils.DeserializeDictionaryFromJson<string, ILocation>(File.ReadAllText(namedLocationsFilePath)).ToDictionary()
                : new Dictionary<string, ILocation>()
                {
                    { LastestMergedLocationName, new FileLocation(namedTransactionsFolderPath, DefaultLatestMergedFileName) },
                    { TransactionEditsLocationName, new FileLocation(namedTransactionsFolderPath, DefaultTransactionEditsFileName) }
                } ;
        }

        public string RootFolderPath
        {
            get { return rootFolderPath; }
        }

        public string LastestMergedLocationName
        {
            get { return DefaultLatestMergedFileName; }
        }

        public string TransactionEditsLocationName
        {
            get { return DefaultTransactionEditsFileName; }
        }

        public IStorageOperations<TransactionEdits> TransactionEditsStorage
        {
            get { return transactionEditsStorage; }
        }

        public IStorageOperations<Transactions> TransactionsStorage
        {
            get { return transactionsStorage; }
        }

        private static string GetDropBoxPath()
        {
            var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
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
                    var fileNames = Directory.EnumerateFiles(startLocation.Address, fileFilter, SearchOption.TopDirectoryOnly)
                        .Select(Path.GetFileName);
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

        public void AddAccountConfig(AccountConfig accountConfig)
        {
            var accountFolder = Path.Combine(this.importFolderPath, accountConfig.AccountInfo.Id);
            if (!Directory.Exists(accountFolder))
                Directory.CreateDirectory(accountFolder);

            var accountConfigFilePath = Path.Combine(accountFolder, AccountConfigFileName);

            if (File.Exists(accountConfigFilePath))
                throw new Exception("Account config file {0} already exist. Cannot add new account.".FormatEx(accountConfigFilePath));

            File.WriteAllText(accountConfigFilePath, accountConfig.SerializeToJson());

            MessagePipe.SendMessage("Account added at {0}".FormatEx(accountConfigFilePath));
        }


        public class TransactionsStorageOperations : IStorageOperations<Transactions>
        {

            public Transactions Load(ILocation location)
            {
                switch (location.ContentType)
                {
                    case ContentType.Csv:
                        var csvTransactions = new Transactions(location.PortableAddress);
                        AddTransactionsFromCsvFile(csvTransactions, location.Address, location.AccountConfig.AccountInfo, location.ImportInfo);;
                        return csvTransactions;
                    case ContentType.Json:
                        var serializedData = File.ReadAllText(location.Address);
                        return Transactions.DeserializeFromJson(serializedData);
                    case ContentType.None:
                    default:
                        throw new ArgumentException("location.ContentType value {0} is not supported for loading transaction".FormatEx(location.ContentType));
                }
            }

            public void Save(ILocation location, Transactions transactions)
            {
                var serializedData = transactions.SerializeToJson();
                File.WriteAllText(location.Address, serializedData);

                MessagePipe.SendMessage("Saved {0}".FormatEx(location.Address));
            }

            public bool Exists(ILocation location)
            {
                return File.Exists(location.Address);
            }

            private static void AddTransactionsFromCsvFile(Transactions transactions, string file, AccountInfo accountInfo, ImportInfo importInfo)
            {
                var lines = File.ReadLines(file).RemoveNullOrEmpty().ToList();
                var headerColumns = (string[])null;
                for (var lineNumber = 0; lineNumber < lines.Count; lineNumber++)
                {
                    var line = lines[lineNumber];
                    if (headerColumns == null)
                        headerColumns = Utils.ParseCsvLine(line).ToArray();
                    else
                        transactions.AddFromCsvLine(headerColumns, line, lineNumber, accountInfo, importInfo);
                }
            }
        }

        public class TransactionEditsStorageOperations : IStorageOperations<TransactionEdits>
        {

            public TransactionEdits Load(ILocation location)
            {
                return TransactionEdits.DeserializeFromJson(File.ReadAllText(location.Address));
            }

            public void Save(ILocation location, TransactionEdits transactions)
            {
                var serializedData = transactions.SerializeToJson();
                File.WriteAllText(location.Address, serializedData);

                MessagePipe.SendMessage("Saved {0}".FormatEx(location.Address));
            }

            public bool Exists(ILocation location)
            {
                return File.Exists(location.Address);
            }
        }

    }
}
