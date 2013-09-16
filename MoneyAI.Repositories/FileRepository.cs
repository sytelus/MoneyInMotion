using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyAI.Repositories
{
    public class FileRepository : IRepository
    {
        private readonly string rootFolderPath, importFolderPath, namedLocationsFilePath;
        private readonly IDictionary<string, ILocation> namedLocations;
        private readonly IStorage<TransactionEdits> transactionEditsStorage = new TransactionEditsStorage();
        private readonly IStorage<Transactions> transactionsStorage;

        const string DefaultRelativeDropBoxFolder = "MoneyAI", DefaultRelativeImportFolder = "Statements", DefaultRelativeNamedTransactionsFolder = "Merged"
            , DefaultLatestMergedFileName = "LatestMerged.json", DefaultTransactionEditsFileName = "LatestMergedEdits.json"
            , DropBoxHostFileName = "Dropbox\\host.db";
        const string AccountConfigFileName = @"AccountConfig.json", NamedLocationsFileName = @"NamedLocations.json";

        public FileRepository(string rootFolderPath = null)
        {
            this.transactionsStorage = new TransactionsStorage(transactionEditsStorage);

            this.rootFolderPath = rootFolderPath ?? Path.Combine(GetDropBoxPath(), DefaultRelativeDropBoxFolder);

            importFolderPath = Path.Combine(this.rootFolderPath, DefaultRelativeImportFolder);
            var namedTransactionsFolderPath = Path.Combine(this.rootFolderPath, DefaultRelativeNamedTransactionsFolder);

            namedLocationsFilePath = Path.Combine(namedTransactionsFolderPath, NamedLocationsFileName);
            namedLocations = File.Exists(namedLocationsFilePath)
                ? Utils.DeserializeDictionaryFromJson<string, ILocation>(File.ReadAllText(namedLocationsFilePath)).ToDictionary()
                : new Dictionary<string, ILocation>()
                {
                    { LastestMergedLocationName, new FileLocation(namedTransactionsFolderPath, DefaultLatestMergedFileName) },
                    { LastestMergedEditsLocationName, new FileLocation(namedTransactionsFolderPath, DefaultTransactionEditsFileName) }
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

        public string LastestMergedEditsLocationName
        {
            get { return DefaultTransactionEditsFileName; }
        }

        public IStorage<TransactionEdits> TransactionEditsStorage
        {
            get { return transactionEditsStorage; }
        }

        public IStorage<Transactions> TransactionsStorage
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
    }
}
