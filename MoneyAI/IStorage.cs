using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace MoneyAI
{
    public interface IStorage<TEntity>
    {
        TEntity Load(ILocation location);
        void Save(ILocation location, TEntity entity, ILocation auxilaryComponentLocation = null);
        bool Exists(ILocation location);
    }
}
