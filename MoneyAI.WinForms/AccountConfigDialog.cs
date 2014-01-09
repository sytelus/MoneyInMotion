﻿using System;
using System.Windows.Forms;

namespace MoneyAI.WinForms
{
    public partial class AccountConfigDialog : Form
    {
        public AccountConfigDialog()
        {
            InitializeComponent();
        }

        private void AccountInfoDialog_Load(object sender, EventArgs e)
        {

        }

        public static AccountConfig GetNewAccountInfo(IWin32Window dialogOwner)
        {
            using (var dialog = new AccountConfigDialog())
            {
                if (dialog.ShowDialog(dialogOwner) == DialogResult.OK)
                {
                    var accountInfo = new AccountInfo(dialog.GetAccountType(), dialog.textBoxAccountName.Text,
                        dialog.textBoxInstituteName.Text, dialog.textBoxAccountName.Text, false);
                    var accountConfig = new AccountConfig(accountInfo);

                    return accountConfig;
                }
                else return null;
            }
        }

        private AccountInfo.AccountType GetAccountType()
        {
            if (radioButtonCreditCard.Checked)
                return AccountInfo.AccountType.CreditCard;
            else if (radioButtonCheckingAccount.Checked)
                return AccountInfo.AccountType.BankChecking;
            else if (radioButtonSavingsAccount.Checked)
                return AccountInfo.AccountType.BankSavings;
            else 
                throw new Exception("At least one Account Type radiobutton must be checked!");

        }
    }
}
