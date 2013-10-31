using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MoneyAI.WinForms
{
    public partial class NoteDialogForm : Form
    {
        public NoteDialogForm()
        {
            InitializeComponent();
        }

        public bool IsNoteRemoved { get; private set; }

        private void buttonRemove_Click(object sender, EventArgs e)
        {
            IsNoteRemoved = true;
        }


        public static string GetNoteFromUser(string initial, IWin32Window parentForm)
        {
            using (var dialog = new NoteDialogForm())
            {
                dialog.richTextBoxNote.Text = initial;
                var dialogResult = dialog.ShowDialog(parentForm);
                if (dialogResult == DialogResult.OK)
                {
                    if (dialog.IsNoteRemoved)
                        return null;
                    else
                        return dialog.richTextBoxNote.Text;
                }
                else return initial;
            }
        }

        private void NoteDialogForm_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Control && e.KeyCode == Keys.Enter)
            {
                DialogResult = DialogResult.OK;
                e.Handled = true;
                e.SuppressKeyPress = true;
                Close();
            }
        }

    }
}
