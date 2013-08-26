using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using CommonUtils;
using MoneyInMotion.Properties;

namespace MoneyInMotion
{
    public partial class FormMain : Form
    {
        public FormMain()
        {
            InitializeComponent();
        }

        private Transactions latestMerged = null;
        private string defaultRootPath;
        private DiskTransactionRepository repository;
        private void FormMain_Load(object sender, EventArgs e)
        {
            MessagePipe.AddListner(UpdateLog, listnerKey: "FormMain");

            repository = new DiskTransactionRepository(Settings.Default.RootFolder.NullIfEmpty());
            defaultRootPath = repository.RootFolderPath;

            textBoxRootFolder.Text = defaultRootPath;
        }

        private void FormMain_FormClosed(object sender, FormClosedEventArgs e)
        {
            MessagePipe.RemoveListner("FormMain");

            if (textBoxRootFolder.Text != defaultRootPath)
            {
                Settings.Default.RootFolder = textBoxRootFolder.Text;
                Settings.Default.Save();
            }
        }


        private void UpdateLog(object message)
        {
            richTextBoxLog.AppendText(message.ToString());
            richTextBoxLog.AppendText("\n");
        }

        private void buttonAddAccount_Click(object sender, EventArgs e)
        {
            var accountInfo = AccountConfigDialog.GetNewAccountInfo(this);
            if (accountInfo != null)
            {
                repository.AddAccountConfig(accountInfo);
            }
        }

        private void buttonScanStatements_Click(object sender, EventArgs e)
        {
            if (this.latestMerged == null)
            {
                var latestMergedLocation = repository.GetNamedLocation(repository.LastestMergedTransactionsName);
                if (repository.TransactionsExists(latestMergedLocation))
                    latestMerged = repository.Load(latestMergedLocation);
                else
                    latestMerged = new Transactions();
            }

            var statementLocations = repository.GetStatementLocations();
            foreach (var statementLocation in statementLocations)
            {
                if (latestMerged.LocationHashses.Contains(statementLocation.ImportInfo.ContentHash))
                    MessagePipe.SendMessage("Location {0} skipped".FormatEx(statementLocation.Address));
                else
                {
                    var statementTransactions = repository.Load(statementLocation);

                    var oldCount = latestMerged.Count;
                    latestMerged.Merge(statementTransactions);

                    MessagePipe.SendMessage("{0} transactions found ({1} new) in {2}".FormatEx(statementTransactions.Count, latestMerged.Count - oldCount, statementLocation.Address));
                }
            }

        }

        private void buttonSaveLatestMerged_Click(object sender, EventArgs e)
        {
            var latestMergedLocation = repository.GetNamedLocation(repository.LastestMergedTransactionsName);
            repository.Save(latestMerged, latestMergedLocation);
        }
    }
}
