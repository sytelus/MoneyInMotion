using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using CommonUtils;
using MoneyAI.WebApi.Controllers;
using MoneyAI.WebApi.Common;
using System.Runtime.Serialization;

namespace MoneyAI.WebApi
{
    public class TransactionEditsController : ApiController
    {
        [DataContract]
        public class EditResult
        {
            [DataMember(IsRequired = true, Name = "affectedTransactionsCount")]
            public int AffectedTransactionsCount { get; set; }
        }

        // POST api/<controller>
        public HttpResponseMessage Post([FromBody]string value)
        {
            var affectedTransactionsCount = Models.TransactionModel.ApplyEdit("sytelus", value);
            var editResult = new EditResult() { AffectedTransactionsCount = affectedTransactionsCount };

            return this.Request.GetJsonResponse(CommonUtils.JsonSerializer<EditResult>.Serialize(editResult));
        }
    }
}