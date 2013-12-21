using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using CommonUtils;

namespace MoneyAI.WebApi
{
    public class TransactionEditsController : ApiController
    {
        // POST api/<controller>
        public int Post([FromBody]string value)
        {
            return Models.TransactionModel.ApplyEdit("sytelus", value);
        }
    }
}