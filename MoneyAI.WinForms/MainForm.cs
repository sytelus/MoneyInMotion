using System;
using System.Windows.Forms;
using CommonUtils;
using MoneyAI.WinForms.Properties;

namespace MoneyAI.WinForms
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
            this.latestMerged = this.latestMerged ?? MoneyAIUtils.GetLatestMerged(this.repository);

            MoneyAIUtils.MergeNewStatements(this.repository, this.latestMerged);
        }



        private void buttonSaveLatestMerged_Click(object sender, EventArgs e)
        {
            MoneyAIUtils.SaveLatestMerged(this.repository, this.latestMerged);
        }
    }
}
