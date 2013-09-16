using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories
{
    public class TransactionEditsStorage : IStorage<TransactionEdits>
    {
        internal TransactionEditsStorage()
        {
        }

        public TransactionEdits Load(ILocation location)
        {
            return TransactionEdits.DeserializeFromJson(File.ReadAllText(location.Address));
        }

        public void Save(ILocation location, TransactionEdits transactions, ILocation auxilaryComponentLocation = null)
        {
            if (this.Exists(location))
            {
                //Create backup
                var existingFileDateTime = File.GetLastWriteTimeUtc(location.Address);
                var newSuffix = existingFileDateTime.ToString("yyyyMMddHHmmssffff");
                var ext = Path.GetExtension(location.Address);
                var archiveFilePath = Path.ChangeExtension(location.Address, string.Concat(newSuffix, ".", ext));
                File.Copy(location.Address, archiveFilePath);
            }

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
