using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using CommonUtils;

namespace MoneyAI.WinForms
{
    public partial class CategoryDialogForm : Form
    {
        public CategoryDialogForm()
        {
            InitializeComponent();
        }

        private string entityNameNormalized;

        private void radioButtonNameWords_CheckedChanged(object sender, EventArgs e)
        {
            textBoxNameWords.Enabled = radioButtonNameWords.Checked;
            if (textBoxNameWords.Text.Length == 0)
                textBoxNameWords.Text = GetTextBoxNameWordsText(entityNameNormalized.AsEnumerable());
        }

        private static string GetTextBoxNameWordsText(IEnumerable<string> tokens)
        {
            return tokens.ToDelimitedString(" "
                , s => s.Any(c => Char.IsWhiteSpace(c) || c == '\"') 
                        ? string.Concat("\"", s.Replace("\"", "\"\""), "\"") 
                        : s, false);
        }

        public static Tuple<TransactionEdit.ScopeFilter[], string[]> GetCategoryEditFromUser(TransactionEdit lastCategoryEdit
            , Transaction firstSelectedTransaction, ICollection<string> selectedTransactionIds, IWin32Window parentForm)
        {
            using (var dialog = new CategoryDialogForm())
            {
                dialog.entityNameNormalized = firstSelectedTransaction.EntityNameNormalized;

                var currentScopeFilters = lastCategoryEdit.IfNotNull(e => e.ScopeFilters) 
                        ?? new [] { new TransactionEdit.ScopeFilter(TransactionEdit.ScopeType.EntityNameNormalized, new string[] {firstSelectedTransaction.EntityNameNormalized}) };
                var currentCategoryPath = lastCategoryEdit.IfNotNull(e => e.Values.IfNotNull(v => v.CategoryPath.IfNotNull(c => c.GetValueOrDefault())))
                        ?? Utils.EmptyStringArray;

                if (currentScopeFilters.Length != 1)
                    throw new NotSupportedException("Multiple scopes for categories in Windows application is not supported");

                var currentScopeFilter = currentScopeFilters[0];

                string radioButtonNameText = null, textBoxNameWordsText = null, radioButtonNormalizedNameText = null, radioButtonOnlySelectedText = null;

                switch (currentScopeFilter.Type)
                {
                    case TransactionEdit.ScopeType.EntityName:
                        dialog.radioButtonName.Checked = true;
                        radioButtonNameText = dialog.radioButtonName.Text.FormatEx(currentScopeFilter.Parameters[0]); break;
                    case TransactionEdit.ScopeType.EntityNameAnyTokens:
                        dialog.radioButtonNameWords.Checked = true;
                        textBoxNameWordsText = GetTextBoxNameWordsText(currentScopeFilter.Parameters); break;
                    case TransactionEdit.ScopeType.EntityNameNormalized:
                        dialog.radioButtonNormalizedName.Checked = true;
                        radioButtonNormalizedNameText = dialog.radioButtonNormalizedName.Text.FormatEx(currentScopeFilter.Parameters[0]); break;
                    case TransactionEdit.ScopeType.TransactionId:
                        dialog.radioButtonOnlySelected.Checked = true;
                        radioButtonOnlySelectedText = dialog.radioButtonOnlySelected.Text.FormatEx(currentScopeFilter.Parameters.Length
                            , currentScopeFilter.Parameters.Length == 1 ? string.Empty : "s"); break;
                    default:
                        throw new Exception("Scope Type {0} is not supported for creating category based edit".FormatEx(currentScopeFilter.Type));
                }

                dialog.radioButtonName.Text = radioButtonNameText ?? dialog.radioButtonName.Text.FormatEx(firstSelectedTransaction.EntityName);
                dialog.textBoxNameWords.Text = textBoxNameWordsText; // ?? GetTextBoxNameWordsText(firstSelectedTransaction.EntityNameNormalized.AsEnumerable());
                dialog.radioButtonNormalizedName.Text = radioButtonNormalizedNameText ?? dialog.radioButtonNormalizedName.Text.FormatEx(firstSelectedTransaction.EntityNameNormalized);
                dialog.radioButtonOnlySelected.Text = radioButtonOnlySelectedText ?? dialog.radioButtonOnlySelected.Text.FormatEx(selectedTransactionIds.Count
                    , selectedTransactionIds.Count == 1 ? string.Empty : "s");

                if (string.Compare(dialog.radioButtonName.Text, dialog.radioButtonNormalizedName.Text, true) == 0)
                    dialog.radioButtonName.Visible = dialog.radioButtonName.Checked;

                dialog.textBoxCategory.Text = currentCategoryPath.ToDelimitedString(" > ");

                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    TransactionEdit.ScopeType scopeType;
                    string[] scopeParameters;

                    if (dialog.radioButtonName.Checked)
                    {
                        scopeType = TransactionEdit.ScopeType.EntityName;
                        scopeParameters = new string[] { firstSelectedTransaction .EntityName};
                    }
                    else if (dialog.radioButtonNameWords.Checked)
                    {
                        scopeType = TransactionEdit.ScopeType.EntityNameAnyTokens;
                        scopeParameters = Utils.ParseCsvLine(dialog.textBoxNameWords.Text, ' ').RemoveNullOrEmpty().ToArray();
                    }
                    else if (dialog.radioButtonNormalizedName.Checked)
                    {
                        scopeType = TransactionEdit.ScopeType.EntityNameNormalized;
                        scopeParameters = new string[] { firstSelectedTransaction.EntityNameNormalized };
                    }
                    else if (dialog.radioButtonOnlySelected.Checked)
                    {
                        scopeType = TransactionEdit.ScopeType.TransactionId;
                        scopeParameters = selectedTransactionIds.ToArray();
                    }
                    else throw new Exception("None of the expected checkboxes are selected!");

                    var scope = new TransactionEdit.ScopeFilter(scopeType, scopeParameters);
                    var categoryPath = Utils.ParseCsvLine(dialog.textBoxCategory.Text, '>')
                            .Select(s => s.Trim()).RemoveNullOrEmpty().ToArray().NullIfEmpty();

                    return Tuple.Create(new [] {scope}, categoryPath);
                }
                else return null;
            }
        }

        private void CategoryDialogForm_Load(object sender, EventArgs e)
        {
            textBoxCategory.SelectAll();
            textBoxCategory.Focus();
        }

        private void textBoxCategory_TextChanged(object sender, EventArgs e)
        {
        }

    }
}
