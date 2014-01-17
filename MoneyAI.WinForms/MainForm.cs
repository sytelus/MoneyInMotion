using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;
using BrightIdeasSoftware;
using CommonUtils;
using MoneyAI.Repositories;
using MoneyAI.WinForms.Properties;
using System.Net;
using System.IO;
using RestSharp;
using Newtonsoft.Json.Linq;

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

            txnListView.BeforeCreatingGroups += txnListView_BeforeCreatingGroups;

            buttonScanStatements_Click(sender, e);
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
                var repository = new FileRepository(defaultRootPath);
                appState = new AppState(repository);
                appState.LoadLatestMerged();
            }

            appState.MergeNewStatements();

            RefreshExplorer(this.appState.LatestMerged);
        }
        
        private void buttonSaveLatestMerged_Click(object sender, EventArgs e)
        {
            bool saveEdits = true;
            if (appState.LatestMerged.EditsCount == 0 && appState.EditsExists())
                saveEdits = MessageBox.Show(this, "Save Edits", "There are no edits made to these transactions but there exists previous edits. Do you want to overwrite previous edits file?", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) == System.Windows.Forms.DialogResult.Yes;

            appState.SaveLatestMerged(saveEdits);
        }

        private void FormMain_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Insert)
            {
                ToggleFlagsRows(txnListView.SelectedItems, appState.LatestMerged);
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
            else if (e.Control && e.KeyCode == Keys.N)
            {
                ApplyNoteForRows(txnListView.SelectedItems, appState.LatestMerged);
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
            else if (e.KeyCode == Keys.F2)
            {
                ApplyCategoryForRows(txnListView.SelectedItems);
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
        }


#region Etsy Import
        private void GetAccessTokens()
        {
            //TODO: Below code should be converted to RestSharp using this example: https://github.com/restsharp/RestSharp/blob/master/RestSharp.IntegrationTests/oAuth1Tests.cs
            //OAuth classes below are properitory from this class: http://www.deanhume.com/Home/BlogPost/a-simple-guide-to-using-oauth-with-c-/49
            //var etsyURL = @"https://openapi.etsy.com/v2/users/__SELF__/orders";  //?api_key=" + api_key;

            //var OAuth = new OAuth.Manager();
            //var pin = "";
            //OAuth["consumer_key"] = api_key;
            //OAuth["consumer_secret"] = "60txnpyy0c";
            //var requestToken = OAuth.AcquireRequestToken(@"https://openapi.etsy.com/v2/oauth/request_token?scope=transactions_r%20billing_r%20profile_r%20email_r", "POST");

            //Process.Start(Uri.UnescapeDataString(requestToken[@"login_url"]));

            //var accessToken = OAuth.AcquireAccessToken(@"https://openapi.etsy.com/v2/oauth/access_token", "POST", pin);
            //var authzHeader = OAuth.GenerateAuthzHeader(@"https://openapi.etsy.com/v2/users/__SELF__", "GET");

            //Debug.WriteLine(OAuth["token"]);
            //Debug.WriteLine(OAuth["token_secret"]);
            //Debug.WriteLine(authzHeader);

            //var authzHeader = @"OAuth oauth_callback=""oob"", oauth_consumer_key=""mpe5winn3rxunctfaaq7crke"", oauth_nonce=""54297w5d"", oauth_signature=""jSVP%2FkQHIVQXPZK7hRZsnauJ%2BpI%3D"", oauth_signature_method=""HMAC-SHA1"", oauth_timestamp=""1389669583"", oauth_token=""6a2c50247349454712d01a6d3e2b1f"", oauth_verifier=""61cb79c9"", oauth_version=""1.0""";
        }

        private void button1_Click(object sender, EventArgs e)
        {
            var transactionsSavePath = SaveEtsyEntities(@"/users/__SELF__/transactions", "transactions");
            Process.Start(transactionsSavePath);

            var recieptsSavePath = SaveEtsyEntities(@"/users/__SELF__/receipts", "receipts");
            Process.Start(recieptsSavePath);
        }

        private static string SaveEtsyEntities(string restMethod, string saveFilePathTag)
        {
            const string baseUrl = "https://openapi.etsy.com/v2";
            var appSecretsConfigFilePath = CloudStorage.GetDropBoxPath(@"MoneyAI\AppConfig\appSecrets.json");
            var appSecretsConfigJson = File.ReadAllText(appSecretsConfigFilePath);
            var appSecretsConfig = JObject.Parse(appSecretsConfigJson);
            var accessTokens = appSecretsConfig["accessTokens"][0];

            var restClient = new RestClient(baseUrl);
            int? offset = 0;
            var limit = 100;

            restClient.Authenticator = RestSharp.Authenticators.OAuth1Authenticator.ForProtectedResource(
                (string)appSecretsConfig["consumerKey"],
                (string)appSecretsConfig["consumerSecret"],
                (string)accessTokens["accessToken"],
                (string)accessTokens["accessTokenSecret"]);

            JArray transactions = new JArray();

            do
            {
                var request = new RestRequest();
                request.Resource = restMethod;
                request.Method = Method.GET;

                request.AddParameter("offset", offset);
                request.AddParameter("limit", limit);

                var response = restClient.Execute(request);
                if (response.StatusCode == HttpStatusCode.OK)
                {
                    var responseJson = JObject.Parse(response.Content);
                    transactions.AddRange(responseJson["results"]);
                    offset = (int?)responseJson["pagination"]["next_offset"];
                }
                else
                    throw new Exception("Recieved Response {0}-{1}, Body {2} for request {3}, Error: {4}".FormatEx(response.StatusCode, response.StatusDescription, response.Content, response.ResponseUri, response.ErrorMessage));
            } while (offset > 0);

            var savePath = CloudStorage.GetDropBoxPath(@"MoneyAI\Statements\Etsy-Buyer\{0}-{1}-raw-{2}.json"
                .FormatEx((string)accessTokens["userLogin"], saveFilePathTag, DateTime.Now.ToString("yyyyMMdd")));

            File.WriteAllText(savePath, transactions.ToString());
            return savePath;
        }
#endregion
    }
}
