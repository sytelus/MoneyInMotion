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

namespace MoneyInMotion
{
    public partial class FormMain : Form
    {
        public FormMain()
        {
            InitializeComponent();
        }

        Transactions allTransactions = new Transactions();
        private void FormMain_Load(object sender, EventArgs e)
        {
            MessagePipe<int, int, string>.AddListner(0, this.UpdateLog);

            textBoxRootFolder.Text = Properties.Settings.Default.RootFolder;
            ScanStatements(textBoxRootFolder.Text, allTransactions);
        }

        private void FormMain_FormClosed(object sender, FormClosedEventArgs e)
        {
            if (textBoxRootFolder.Text != Properties.Settings.Default.RootFolder)
            {
                Properties.Settings.Default.RootFolder = textBoxRootFolder.Text;
                Properties.Settings.Default.Save();
            }
        }

        private void ScanStatements(string folder, Transactions statements)
        {
            var accountConfigFilePath = Path.Combine(folder, @"account.config");
            bool recurse = true;
            if (File.Exists(accountConfigFilePath))
                recurse = statements.AddFromConfigFile(accountConfigFilePath);

            if (recurse)
            {
                foreach (var subFolder in Directory.GetDirectories(folder))
                    ScanStatements(subFolder, statements);
            }
        }

        private bool UpdateLog(string message)
        {
            this.richTextBoxLog.AppendText(message);
            this.richTextBoxLog.AppendText("\n");
            return true;
        }
    }
}
