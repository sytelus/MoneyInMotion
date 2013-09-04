using System;
using System.Linq;
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

        private string defaultRootPath;
        private AppState appState;
        private void FormMain_Load(object sender, EventArgs e)
        {
            MessagePipe.AddListner(UpdateLog, listnerKey: "FormMain");
            defaultRootPath = Settings.Default.RootFolder.NullIfEmpty();
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
            var accountConfig = AccountConfigDialog.GetNewAccountInfo(this);
            if (accountConfig != null)
                appState.AddAccountConfig(accountConfig);
        }

        private void buttonScanStatements_Click(object sender, EventArgs e)
        {
            if (appState == null)
            {
                var repository = new DiskTransactionRepository(defaultRootPath);
                appState = new AppState(repository);
                appState.Load();
            }

            appState.MergeNewStatements();

            RefreshExplorer();
        }
        
        private void buttonSaveLatestMerged_Click(object sender, EventArgs e)
        {
            appState.Save();
        }

        private void RefreshExplorer()
        {
            this.treeView.Nodes.Clear();
            var rootNode = CreateTreeNode("root", "All");
            this.treeView.Nodes.Add(rootNode);

            var yearNodes = this.appState.LatestMerged.GroupBy(t => t.TransactionDate.Year)
                .Select(g => new Tuple<int, int[]>(g.Key, g.Select(gt => gt.TransactionDate.Month).Distinct().OrderByDescending(m => m).ToArray()))
                .OrderByDescending(tp => tp.Item1)
                .Select(tp => CreateTreeNode(
                      tp.Item1.ToString()
                    , tp.Item1.ToString()
                    , tp.Item2.Select(m => CreateTreeNode(m.ToString(), m.ToString())).ToArray()))
                .ToArray();

            rootNode.Nodes.AddRange(yearNodes);
            rootNode.ExpandAll();
        }

        private static TreeNode CreateTreeNode(string name, string text, TreeNode[] children = null, TreeNode parentNode = null, bool collapse = false)
        {
            var node = new TreeNode(text);
            node.Name = name;

            if (parentNode != null)
                parentNode.Nodes.Add(node);

            if (children != null)
                node.Nodes.AddRange(children);

            if (!collapse)
                node.Expand();

            return node;
        }
    }
}
