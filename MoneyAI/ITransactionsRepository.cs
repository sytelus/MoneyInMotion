using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI
{
    public interface ITransactionsRepository
    {


        IEnumerable<ILocation> GetStatementLocations(ILocation startLocation = null, AccountConfig parentAccountConfig = null);

        ILocation GetNamedLocation(string name);
        void SaveNamedLocation(string name, ILocation location);
        bool NamedLocationExists(string name);
        IEnumerable<KeyValuePair<string, ILocation>> NamedLocations { get; }

        Transactions Load(ILocation location);
        void Save(Transactions transactions, ILocation location);
        bool TransactionsExists(ILocation location);

        string LastestMergedTransactionsName { get; }

        void AddAccountConfig(AccountConfig accountConfig);
    }
}
