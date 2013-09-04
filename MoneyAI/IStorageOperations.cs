using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace MoneyAI
{
    public interface IStorageOperations<T>
    {
        T Load(ILocation location);
        void Save(ILocation location, T entity);
        bool Exists(ILocation location);
    }
}
