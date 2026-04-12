using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.Text.RegularExpressions;
using System.Diagnostics;

namespace MoneyAI
{
    public static class EntityNameNormalizer
    {
        public static string Normalize(string text)
        {
            var tokens = (text ?? string.Empty).Split();
            var cleanedName = tokens.SelectMany(t => NormalizeToken(t))
                .RemoveNullOrWhiteSpace()
                .ToDelimitedString(" ")
                .Trim();

            //Determine if we should convert to title case or lower case
            var hasAnyUpperCase = cleanedName.Any(Char.IsUpper);
            var hasAnyLowerCase = cleanedName.Any(Char.IsLower);
            //If mixed case then skip case conversion
            if (!(hasAnyLowerCase && hasAnyUpperCase))
            {
                var isAllUpperCase = !hasAnyLowerCase && cleanedName.All(c => Char.IsUpper(c) || !char.IsLetter(c));
                var hasDot = cleanedName.IndexOf('.') > 1; //Posible .com names
                if (isAllUpperCase)
                    cleanedName = !hasDot ? cleanedName.ToTitleCase() : cleanedName.ToLower();
            }

            if (cleanedName.Length == 0)
                cleanedName = text.Trim();

            return cleanedName;

        }

        private static readonly Regex slicerRegex = new Regex(@"([^\p{L}]*)([\p{L}]+.*?)([^\p{L}]*)", 
            RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex nonDigits = new Regex(@"[^\p{N}]*",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static IEnumerable<string> NormalizeToken(string token)
        {
            var cleanedToken = new StringBuilder();

            //Slice the token in to parts
            var matches = slicerRegex.Matches(token);
            for(var matchIndex = 0; matchIndex < matches.Count; matchIndex++)
            {
                var groups = matches[matchIndex].Groups;
                //Group 0 is the matched string
                var startingNonLetterPart = groups[1].Value;
                var middleNonLetterPart = groups[2].Value;
                var finalNonLetterPart = groups[3].Value;

                if (matchIndex > 0)
                    cleanedToken.Append(startingNonLetterPart);
                cleanedToken.Append(middleNonLetterPart);
                if (matchIndex == matches.Count - 1)
                {
                    var finalNonLetterPartCleaned = nonDigits.Replace(finalNonLetterPart, string.Empty);
                    if (finalNonLetterPartCleaned.Length < 4)
                        cleanedToken.Append(finalNonLetterPartCleaned);
                }
                else
                    cleanedToken.Append(finalNonLetterPart);
            }

            yield return cleanedToken.ToString();
        }
    }
}
