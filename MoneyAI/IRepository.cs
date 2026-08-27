using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI
{
    public interface IRepository
    {


        IEnumerable<ILocation> GetStatementLocations(ILocation startLocation = null, AccountConfig parentAccountConfig = null);

        ILocation GetNamedLocation(string name);
        void SaveNamedLocation(string name, ILocation location);
        bool NamedLocationExists(string name);
        IEnumerable<KeyValuePair<string, ILocation>> NamedLocations { get; }

        IStorage<Transactions> TransactionsStorage { get; }
        IStorage<TransactionEdits> TransactionEditsStorage { get; }

        string LastestMergedLocationName { get; }
        string LastestMergedEditsLocationName { get; }

        void AddAccountConfig(AccountConfig accountConfig);
    }
}
