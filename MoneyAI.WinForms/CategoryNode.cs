using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using CommonUtils;

namespace MoneyAI.WinForms
{
    internal class CategoryNode
    {
        public IDictionary<string, CategoryNode> Children { get; private set; }
        public string Name { get; private set; }
        public decimal AmountSum { get; private set; }
        public int TransactionCount { get; private set; }

        public CategoryNode(string name)
        {
            Children = new Dictionary<string, CategoryNode>();
            Name = name;
        }

        public void Merge(string[] categoryPath, decimal amountSum, int transactionCount)
        {
            var current = this;
            foreach (var category in categoryPath)
            {
                var found = current.Children.GetValueOrDefault(category);
                if (found == null)
                {
                    found = new CategoryNode(category);
                    current.Children.Add(category, found);
                }

                found.AmountSum += Math.Abs(amountSum);
                found.TransactionCount += transactionCount;

                current = found;
            }
        }

        public void BuildTreeViewNodes(TreeNode treeViewNode, int year, int month, string[] parentCategoryPath = null)
        {
            foreach (var childCategoryNode in Children.Values.OrderBy(cn => cn.Name)) //To sort by total amount, use cn.AmountSum
            {
                var treeNodeData = new TreeNodeData()
                {
                    Text = "{0}  ({1})".FormatEx(childCategoryNode.Name, childCategoryNode.TransactionCount),
                    YearFilter = year,
                    MonthFilter = month,
                    CategoryPathFilter = parentCategoryPath == null ? new string[] {childCategoryNode.Name} : parentCategoryPath.Concat(childCategoryNode.Name).ToArray()
                };
                var childTreeViewNode = CreateTreeNode(treeViewNode, treeNodeData);

                childCategoryNode.BuildTreeViewNodes(childTreeViewNode, year, month, treeNodeData.CategoryPathFilter);
            }
        }

        internal static TreeNode CreateTreeNode(TreeNode parentNode, TreeNodeData treeNodeData)
        {
            var node = new TreeNode(treeNodeData.Text);
            node.Tag = treeNodeData;

            if (parentNode != null)
                parentNode.Nodes.Add(node);
            return node;
        }
    }
}
