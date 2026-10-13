// On-call 模擬器 (On-call Simulator). Five common backend incidents played as a choose-your-response story:
// alerts arrive in an incident channel, every action costs simulated minutes and some make things worse, and
// it ends with a postmortem (time to fix, traps hit, the fastest path, follow-ups). Pure front end; the best
// grade per incident stays in this browser (localStorage "oncall.best"). index.html loads this file the first
// time the window opens.
(function(){
  // Steps run in order. An option either moves on (go), ends the incident (fix), or leaves you on the same step
  // and is greyed out (a trap, the egg, or a half-measure). min is the simulated minutes it costs; the meter
  // grows by `rate` per minute plus any `hit`; `rate` on an option replaces the rate from then on.
  var SCN = [
    {
      id:"pool", clock:"03:07", rate:4,
      name:{zh:"連線池滿了", en:"Connection pool exhausted"},
      hook:{zh:"API 回應時間飆到 8 秒，5xx 一直往上爬。", en:"API latency hits 8 seconds and 5xx errors keep climbing."},
      meter:{zh:"客訴", en:"Complaints"},
      alerts:[
        {sev:"P1", text:{zh:"api p99 延遲 8.2 秒（SLO 500 ms）", en:"api p99 latency 8.2 s (SLO 500 ms)"}},
        {sev:"P1", text:{zh:"5xx 比例 23%", en:"5xx rate 23%"}}
      ],
      steps:[
        {ask:{zh:"先看哪裡？", en:"Where do you look first?"}, opts:[
          {min:2, go:1, label:{zh:"看監控儀表板", en:"Open the dashboards"},
           say:{zh:"API 機器 CPU 15%、記憶體正常；資料庫連線數卡在 100/100，資料庫 CPU 92%。", en:"API hosts: CPU 15%, memory fine. Database connections pinned at 100/100, database CPU 92%."}},
          {min:3, go:1, label:{zh:"看 API 服務的 log", en:"Read the API service logs"},
           say:{zh:"滿滿都是 Connection is not available, request timed out after 30000ms：連線池裡的連線全被佔住，新請求拿不到。", en:"Wall-to-wall \"Connection is not available, request timed out after 30000ms\": every pooled connection is taken and new requests can't get one."}},
          {min:13, trap:1, label:{zh:"直接重啟 API 服務", en:"Restart the API service"},
           say:{zh:"重啟後 5xx 降到 0……8 分鐘後又回到 25%。連線池重新開始是空的，很快又被同一批東西塞滿。", en:"After the restart 5xx drops to zero... and is back at 25% eight minutes later. The pool starts empty and fills up with the same thing again."}}
        ]},
        {ask:{zh:"連線池滿了。下一步？", en:"The pool is full. Next?"}, opts:[
          {min:3, go:1, label:{zh:"到資料庫看正在跑的查詢（processlist、慢查詢紀錄）", en:"Look at the queries running in the database (processlist, slow query log)"},
           say:{zh:"有 80 條一模一樣的查詢，各跑了 30–60 秒：SELECT … FROM orders WHERE DATE(created_at) = '…'，來自凌晨 3:00 開始的「每日營收報表」排程。", en:"80 identical queries, each running 30–60 s: SELECT … FROM orders WHERE DATE(created_at) = '…', from the daily revenue report that starts at 3:00 a.m."}},
          {min:10, go:1, label:{zh:"叫醒 DBA", en:"Wake up the DBA"},
           say:{zh:"DBA 過了 7 分鐘才接起電話：「你看一下 processlist，我猜是 3 點的報表。」你一看，果然是。", en:"The DBA picks up after seven minutes: \"Check the processlist, I bet it's the 3 a.m. report.\" It is."}},
          {min:10, trap:1, hit:30, label:{zh:"把連線池從 100 調大到 300", en:"Raise the pool from 100 to 300"},
           say:{zh:"改設定、重新部署花了 6 分鐘。結果資料庫 CPU 衝到 100%，所有查詢都變慢，5xx 反而升到 40%，你又花 4 分鐘改回來。連線池滿是症狀，不是原因。", en:"Changing the config and redeploying takes six minutes. Database CPU hits 100%, every query slows down, 5xx climbs to 40%, and you spend four more minutes reverting. A full pool is the symptom, not the cause."}}
        ]},
        {ask:{zh:"找到了：報表的慢查詢。怎麼止血？", en:"Found it: the report's slow queries. How do you stop the bleeding?"}, opts:[
          {min:4, fix:1, label:{zh:"先暫停報表排程，再 kill 掉這些慢查詢", en:"Pause the report job first, then kill the slow queries"},
           say:{zh:"連線數掉到 18/100，p99 回到 180 ms，5xx 歸零。", en:"Connections fall to 18/100, p99 is back to 180 ms, 5xx at zero."}},
          {min:5, trap:1, label:{zh:"直接 kill 掉慢查詢", en:"Just kill the slow queries"},
           say:{zh:"連線數掉下來了……3 分鐘後排程自動重試，又塞滿了。來源沒停，砍再多都會回來。", en:"Connections drop... and three minutes later the job retries and fills them again. Until the source stops, they keep coming back."}},
          {min:22, trap:1, hit:20, label:{zh:"現在就幫 orders 表加索引", en:"Add an index to orders right now"},
           say:{zh:"4,000 萬筆的表，建索引跑了 20 分鐘，期間還吃掉資料庫的 CPU 和 IO，止不了血。索引是事後的根治，不是現在的止血。", en:"On 40 million rows the index takes 20 minutes to build and eats database CPU and IO the whole time. An index is the cure for later, not the tourniquet for now."}}
        ]}
      ],
      cause:{zh:"凌晨 3:00 的營收報表用了 DATE(created_at) = ?，函式包住欄位讓索引失效，每條查詢都掃整張表。80 條同時跑，把資料庫連線全部佔住，API 拿不到連線就逾時。", en:"The 3 a.m. revenue report filters on DATE(created_at) = ?. Wrapping the column in a function stops the index from being used, so every query scans the whole table. Eighty of them at once held every database connection, and the API timed out waiting for one."},
      todo:[
        {zh:"查詢改成 created_at >= ? AND created_at < ?，讓索引用得上", en:"Rewrite the filter as created_at >= ? AND created_at < ? so the index applies"},
        {zh:"報表改到唯讀副本跑，不跟線上流量搶連線", en:"Run reports on a read replica, away from live traffic"},
        {zh:"批次工作的查詢設逾時，跑太久就直接中斷", en:"Give batch queries a timeout so runaway ones are cut off"}
      ],
      lesson:{zh:"連線池滿是症狀，不是原因：先找出是誰佔住連線，停掉來源止血，再回頭根治。", en:"A full pool is a symptom, not a cause: find who is holding the connections, stop the source, then fix it properly."}
    },
    {
      id:"cron", clock:"00:20", rate:3,
      name:{zh:"排程跑了兩次", en:"The job ran twice"},
      hook:{zh:"今天的會員點數，發了平常的兩倍。", en:"Tonight's loyalty points went out at twice the usual amount."},
      meter:{zh:"客訴", en:"Complaints"},
      alerts:[
        {sev:"P2", text:{zh:"每日點數發放總額 2.0 倍（平常 ±5%）", en:"Daily points issued: 2.0× (normally ±5%)"}},
        {sev:"P3", text:{zh:"客服信箱：「我的點數怎麼多了一倍？」", en:"Support inbox: \"Why did my points double?\""}}
      ],
      steps:[
        {ask:{zh:"先做什麼？", en:"What do you do first?"}, opts:[
          {min:3, go:1, label:{zh:"看排程的執行紀錄", en:"Check the job's run history"},
           say:{zh:"00:00:00 在 worker-1 跑了一次，00:00:01 在 worker-2 又跑了一次。上週為了扛流量，worker 從一台擴成兩台。", en:"It ran on worker-1 at 00:00:00 and again on worker-2 at 00:00:01. Last week the workers were scaled from one to two for traffic."}},
          {min:8, trap:1, label:{zh:"回滾昨天的部署", en:"Roll back yesterday's deploy"},
           say:{zh:"昨天的部署只改了前端文案，回滾完點數還是多的。不是每個事故都是最近一次部署造成的。", en:"Yesterday's deploy only changed some front-end copy; after the rollback the points are still doubled. Not every incident comes from the latest deploy."}},
          {min:6, trap:1, hit:40, label:{zh:"馬上寫 SQL 把多發的點數扣回來", en:"Write SQL to claw the points back right now"},
           say:{zh:"你用「今天有兩筆發放的會員」當條件扣點，結果把今天剛好有兩筆合法加點（例如生日禮）的會員也一起扣了，客服信箱炸開。補救之前要先算清楚範圍。", en:"You deduct from \"members with two grants today\" and also hit everyone who legitimately got two today, birthday gifts included. The support inbox explodes. Work out the scope before you repair anything."}}
        ]},
        {ask:{zh:"為什麼兩台都會跑？", en:"Why did both machines run it?"}, opts:[
          {min:2, go:1, label:{zh:"看排程是怎麼寫的", en:"Read how the job is scheduled"},
           say:{zh:"排程寫在應用程式裡，每台機器各自觸發，沒有分散式鎖，發點數也沒有冪等鍵。一台的時候沒事，兩台就各跑一次。", en:"The schedule lives in the application, so every machine fires it. No distributed lock, no idempotency key on the grant. Fine with one machine; with two, each runs it once."}},
          {min:12, go:1, label:{zh:"叫醒寫這支排程的同事", en:"Wake the engineer who wrote the job"},
           say:{zh:"同事過了 10 分鐘回電：「啊……當初預設只會有一台。」", en:"Ten minutes later they call back: \"Oh... we assumed there'd only ever be one.\""}}
        ]},
        {ask:{zh:"先擋住、再補救。下一步？", en:"Contain it, then repair it. Next?"}, opts:[
          {min:10, go:1, label:{zh:"停掉今晚的排程，撈出「同一會員、同一天、同一種發放」的重複紀錄，先 dry-run 算人數", en:"Stop tonight's job, find duplicates by member, day and grant type, and dry-run the count"},
           say:{zh:"12,034 位會員各多了 50 點，其中 1,820 位已經花掉一部分。名單確定了，排程也不會再重試。", en:"12,034 members got 50 extra points each; 1,820 have already spent some. The list is settled and the job won't retry."}},
          {min:4, trap:1, label:{zh:"把 worker-2 關掉就好", en:"Just shut down worker-2"},
           say:{zh:"明天不會再跑兩次了，但今天多發的點數還在，而且只剩一台，明天中午的尖峰扛不住。", en:"It won't run twice tomorrow, but today's extra points are still out there, and one machine won't survive tomorrow's lunchtime peak."}}
        ]},
        {ask:{zh:"已經被花掉的點數怎麼處理？", en:"What about points that were already spent?"}, opts:[
          {min:5, fix:1, label:{zh:"花掉的不追回，其餘扣回，並發公告說明", en:"Leave the spent points, reclaim the rest, and post a notice"},
           say:{zh:"扣回腳本照 dry-run 的名單跑完，數字對得上。公告寫清楚是系統錯誤、已花掉的不追回，客服照著回覆。", en:"The reclaim script runs against the dry-run list and the numbers match. The notice says it was our error and spent points stay spent; support replies from it."}},
          {min:6, trap:1, hit:60, label:{zh:"全部扣回，扣到變負數也沒關係", en:"Reclaim everything, even into a negative balance"},
           say:{zh:"1,820 位會員的點數變成負的，App 顯示「餘額 -35」，客服電話整晚沒停。錯是我們犯的，代價不該讓會員扛。", en:"1,820 members now show a balance of -35 and the support line rings all night. The mistake was ours; members shouldn't pay for it."}}
        ]}
      ],
      cause:{zh:"每日發點數的排程寫在應用程式裡，沒有分散式鎖，寫入也沒有冪等鍵。上週 worker 從一台擴成兩台，兩台在 00:00 各跑了一次。", en:"The daily grant job lives in the application with no distributed lock and no idempotency key on the write. Last week the workers went from one to two, and at midnight each ran it."},
      todo:[
        {zh:"排程加分散式鎖（例如 ShedLock，或 Redis 的 SET NX），同一時間只讓一台跑", en:"Add a distributed lock (ShedLock, or Redis SET NX) so only one machine runs it"},
        {zh:"發放紀錄加唯一鍵（會員 + 日期 + 發放類型），重跑也不會重複發", en:"Put a unique key on grants (member + date + type) so a rerun can't double up"},
        {zh:"擴容檢查表加一項：有沒有只能跑一次的工作", en:"Add \"anything that must run only once?\" to the scale-out checklist"}
      ],
      lesson:{zh:"擴容會打破「這段只會跑一次」的假設：排程要有鎖，寫入要冪等；補救前先 dry-run，範圍算清楚再動手。", en:"Scaling out breaks \"this only runs once\": jobs need a lock, writes need to be idempotent, and repairs need a dry run before anything changes."}
    },
    {
      id:"cache", clock:"03:31", rate:5,
      name:{zh:"快取雪崩", en:"Cache stampede"},
      hook:{zh:"Redis 例行升級重啟後，資料庫 CPU 衝到 100%。", en:"After a routine Redis upgrade and restart, database CPU hits 100%."},
      meter:{zh:"客訴", en:"Complaints"},
      alerts:[
        {sev:"P1", text:{zh:"資料庫 CPU 100%", en:"Database CPU 100%"}},
        {sev:"P1", text:{zh:"商品頁 p99 6.1 秒，5xx 15%", en:"Product page p99 6.1 s, 5xx 15%"}},
        {sev:"P3", text:{zh:"Redis 命中率 0%", en:"Redis hit rate 0%"}}
      ],
      steps:[
        {ask:{zh:"Redis 剛重啟完，資料庫就爆了。先做什麼？", en:"Redis just restarted and the database is melting. First move?"}, opts:[
          {min:3, go:1, label:{zh:"看資料庫在忙什麼", en:"See what the database is busy with"},
           say:{zh:"九成是同一支「商品詳情」查詢，熱門商品每秒被查幾百次。快取全部同時變空，所有請求一起回源，這就是快取雪崩（cache stampede）。", en:"Ninety percent is one product-detail query, with popular products fetched hundreds of times a second. The whole cache emptied at once and every request went to the source together: a cache stampede."}},
          {min:4, trap:1, hit:10, label:{zh:"再重啟一次 Redis", en:"Restart Redis again"},
           say:{zh:"快取又空了一次，情況一模一樣。Redis 沒壞，壞的是「所有東西同時沒有快取」。", en:"The cache empties again and nothing changes. Redis isn't broken; the problem is that nothing is cached at the same time."}},
          {min:20, trap:1, hit:25, label:{zh:"緊急把資料庫升級到更大的規格", en:"Upgrade the database to a bigger instance now"},
           say:{zh:"升級要 20 分鐘，中間切換時還斷線 30 秒。等它升完，你早該用別的方法止血了。", en:"The upgrade takes 20 minutes and drops connections for 30 seconds during the switch. You should have stopped the bleeding some other way long before it finished."}}
        ]},
        {ask:{zh:"怎麼先讓資料庫喘口氣？", en:"How do you give the database room to breathe?"}, opts:[
          {min:4, go:1, rate:2, label:{zh:"開啟限流，先關掉「推薦商品」「瀏覽紀錄」這些非核心功能", en:"Turn on rate limiting and switch off non-essentials like recommendations and browsing history"},
           say:{zh:"資料庫 CPU 降到 70%，下單和結帳恢復正常，商品頁還是偏慢。先保住最重要的路徑。", en:"Database CPU drops to 70%, checkout works again, product pages are still slow. Protect the critical path first."}},
          {min:5, trap:1, hit:15, label:{zh:"把 API 逾時從 3 秒調成 10 秒", en:"Raise the API timeout from 3 s to 10 s"},
           say:{zh:"請求等得更久、佔住的連線更多，資料庫前面排的隊更長。逾時調長只會讓塞車更嚴重。", en:"Requests wait longer, hold more connections, and the queue in front of the database grows. A longer timeout only makes the jam worse."}}
        ]},
        {ask:{zh:"讓快取回來：", en:"Bring the cache back:"}, opts:[
          {min:6, fix:1, label:{zh:"用腳本預熱最熱門的 1,000 個商品", en:"Warm the 1,000 most popular products with a script"},
           say:{zh:"命中率回到 85%，資料庫 CPU 降到 35%，p99 回到 250 ms，非核心功能逐一打開。", en:"Hit rate back to 85%, database CPU at 35%, p99 at 250 ms. The non-essentials come back one by one."}},
          {min:25, fix:1, label:{zh:"什麼都不做，等快取自己慢慢長回來", en:"Do nothing and let the cache refill on its own"},
           say:{zh:"25 分鐘後命中率才慢慢回到八成。修好了，但這段時間都在用降級模式撐。", en:"Twenty-five minutes later the hit rate creeps back to 80%. It's fixed, but you ran degraded the whole time."}}
        ]}
      ],
      cause:{zh:"Redis 重啟後快取全部變空，熱門商品的請求同時回源到資料庫。快取平常替資料庫擋掉九成以上的讀取，一拿掉，資料庫就扛不住。", en:"The restart emptied the cache, and requests for popular products all went to the database at once. The cache normally absorbs over 90% of reads; without it the database couldn't cope."},
      todo:[
        {zh:"快取到期時間加隨機值（jitter），避免大量 key 同時過期", en:"Add jitter to expiry times so keys don't expire together"},
        {zh:"熱門 key 回源加互斥（single-flight），同一個 key 只放一個請求去查資料庫", en:"Single-flight the refill: one request per key goes to the database"},
        {zh:"Redis 升級改用副本切換，不讓快取整個清空；真的要清空前先預熱", en:"Upgrade Redis by failing over to a replica instead of emptying it, and warm up before any planned flush"}
      ],
      lesson:{zh:"快取不只是加速，它也在替資料庫擋流量。拿掉之前，先想好誰來擋。", en:"A cache doesn't just speed things up; it shields the database. Before you remove it, know what will take the load."}
    },
    {
      id:"kafka", clock:"01:50", rate:3,
      name:{zh:"Kafka 卡住", en:"Kafka consumer stuck"},
      hook:{zh:"訂單通知延遲 40 分鐘，consumer lag 一直漲。", en:"Order notifications are 40 minutes late and consumer lag keeps rising."},
      meter:{zh:"客訴", en:"Complaints"},
      alerts:[
        {sev:"P2", text:{zh:"order-notify consumer lag 48,000，持續上升", en:"order-notify consumer lag 48,000 and rising"}},
        {sev:"P3", text:{zh:"客服：下單後沒收到確認通知", en:"Support: customers aren't getting order confirmations"}}
      ],
      steps:[
        {ask:{zh:"先做什麼？", en:"What do you do first?"}, opts:[
          {min:3, go:1, label:{zh:"看 consumer 的 log", en:"Read the consumer logs"},
           say:{zh:"partition 4 一直在重試同一筆訊息（offset 1,203,377）：JsonParseException: Unexpected character。每次失敗就從頭再來，後面的訊息全部排隊。", en:"Partition 4 keeps retrying the same message (offset 1,203,377): JsonParseException: Unexpected character. Each failure starts over, and everything behind it waits."}},
          {min:5, trap:1, label:{zh:"把 consumer 從 3 個加到 12 個", en:"Scale the consumers from 3 to 12"},
           say:{zh:"topic 只有 6 個 partition，多出來的 consumer 根本分不到工作；卡住的 partition 4 還是卡住。", en:"The topic has only 6 partitions, so the extra consumers get nothing to do, and partition 4 is as stuck as before."}},
          {min:4, trap:1, label:{zh:"重啟 consumer", en:"Restart the consumers"},
           say:{zh:"重啟後從上次 commit 的 offset 繼續，馬上又撞到同一筆壞訊息。", en:"They resume from the last committed offset and hit the same bad message straight away."}}
        ]},
        {ask:{zh:"這筆壞訊息怎麼處理？", en:"What do you do with the bad message?"}, opts:[
          {min:4, go:1, rate:0, label:{zh:"把它送進錯誤佇列（DLQ），commit 跳過", en:"Send it to the dead-letter queue (DLQ) and commit past it"},
           say:{zh:"partition 4 開始往下消化，lag 從 52,000 一路下降。壞訊息還在 DLQ 裡，沒有丟。", en:"Partition 4 starts draining and lag falls from 52,000. The bad message is parked in the DLQ, not lost."}},
          {min:18, trap:1, hit:60, label:{zh:"把 consumer group 的 offset 直接重設到最新", en:"Reset the consumer group's offset to latest"},
           say:{zh:"lag 瞬間歸零——因為中間 52,000 筆通知全被跳過了。你只好從紀錄找回原本的 offset 再重放一次，多花了 15 分鐘。", en:"Lag drops to zero instantly, because 52,000 notifications were skipped. You dig up the old offset and replay from it, which costs another 15 minutes."}},
          {min:6, trap:1, hit:40, label:{zh:"請上游系統先停止發訊息", en:"Ask the upstream system to stop producing"},
           say:{zh:"上游停了，新訂單也跟著沒有通知；而且卡住的那一筆還在原地。", en:"Upstream stops, so new orders get no notifications either, and the stuck message is still there."}}
        ]},
        {ask:{zh:"lag 在下降了。收尾：", en:"Lag is falling. Wrap it up:"}, opts:[
          {min:8, fix:1, label:{zh:"查壞訊息從哪來、修好解析，再從 DLQ 重送", en:"Trace where the bad message came from, fix the parser, and replay it from the DLQ"},
           say:{zh:"是上游某個版本把金額寫成了「1,200」這種帶逗號的字串。解析修好後，從 DLQ 重送那一筆，通知全部補發完畢。", en:"An upstream release wrote the amount as the string \"1,200\", comma and all. With the parser fixed, the message is replayed from the DLQ and every notification goes out."}}
        ]}
      ],
      cause:{zh:"上游送出一筆格式錯誤的訊息（金額是帶逗號的字串）。consumer 解析失敗就無限重試同一筆；同一個 partition 內要照順序處理，後面的訊息就全部卡住。", en:"Upstream sent a malformed message (the amount as a string with a comma). The consumer retried it forever, and since a partition is processed in order, everything behind it stalled."},
      todo:[
        {zh:"consumer 重試設上限，超過就送 DLQ，不讓一筆訊息卡住整個 partition", en:"Cap consumer retries and send failures to the DLQ, so one message can't block a partition"},
        {zh:"DLQ 要有告警和重送工具，不是丟進去就忘了", en:"Alert on the DLQ and give it a replay tool, so nothing is dropped and forgotten"},
        {zh:"producer 端加 schema 驗證，壞資料一開始就送不出去", en:"Validate the schema on the producer so bad data never gets sent"}
      ],
      lesson:{zh:"一筆壞訊息就能卡住整個 partition：重試要有上限，失敗的要有地方去，不能無限重來。", en:"One bad message can block a whole partition: cap the retries and give failures somewhere to go."}
    },
    {
      id:"cert", clock:"23:40", rate:25,
      name:{zh:"憑證過期", en:"Expired certificate"},
      hook:{zh:"禮拜五 23:40，合作夥伴的 webhook 全部失敗。", en:"Friday, 23:40. Every partner webhook is failing."},
      meter:{zh:"失敗的 webhook", en:"Failed webhooks"},
      alerts:[
        {sev:"P1", text:{zh:"合作夥伴 webhook 失敗率 100%", en:"Partner webhook failure rate 100%"}},
        {sev:"P2", text:{zh:"外部監控：api.example.com TLS 握手失敗", en:"External probe: TLS handshake failed for api.example.com"}}
      ],
      steps:[
        {ask:{zh:"禮拜五晚上，先做什麼？", en:"It's Friday night. First move?"}, opts:[
          {min:2, go:1, label:{zh:"用 openssl 看一下憑證", en:"Inspect the certificate with openssl"},
           say:{zh:"notAfter 是今天 23:39:59。憑證在一分鐘前過期了。", en:"notAfter is today at 23:39:59. The certificate expired a minute ago."}},
          {min:10, go:1, label:{zh:"請合作夥伴清快取再重試", en:"Ask the partner to clear their cache and retry"},
           say:{zh:"對方 10 分鐘後回覆：「我們這邊看到的是 certificate has expired。」", en:"Ten minutes later they reply: \"We're seeing certificate has expired.\""}},
          {min:8, trap:1, label:{zh:"回滾今天的部署", en:"Roll back today's deploy"},
           say:{zh:"今天根本沒有部署。禮拜五不部署，這是祖訓。", en:"There was no deploy today. Nobody deploys on a Friday."}},
          {min:1, egg:1, label:{zh:"先去拜綠色乖乖", en:"Make an offering to the green Kuai Kuai first"},
           say:{zh:"綠色乖乖已經放上機櫃。可惜乖乖只保佑還沒過期的東西。", en:"A packet of green Kuai Kuai is on the rack. Sadly it only protects things that haven't expired yet."}}
        ]},
        {ask:{zh:"憑證過期了。可是今天是禮拜五……", en:"The certificate has expired. But it's Friday..."}, opts:[
          {min:10, fix:1, label:{zh:"手動續期，部署新憑證", en:"Renew it by hand and deploy the new certificate"},
           say:{zh:"新憑證部署上去，TLS 握手恢復，合作夥伴的 webhook 開始重送。", en:"The new certificate is live, TLS handshakes succeed, and partner webhooks start retrying."}},
          {min:15, trap:1, hit:300, label:{zh:"等禮拜一再說，禮拜五不部署", en:"Leave it until Monday. No Friday deploys"},
           say:{zh:"23:58，合作夥伴的 CTO 打電話來了。禮拜五不部署是為了不製造事故，不是為了不修事故。", en:"At 23:58 the partner's CTO calls. \"No Friday deploys\" is about not causing incidents, not about leaving them unfixed."}}
        ]}
      ],
      cause:{zh:"自動續期的 job 三個月前就開始失敗：它做 DNS 驗證用的 API token 被輪替了，job 每次都報錯，但只寫在 log 裡，沒人收到通知。憑證一到期，所有 TLS 連線就失敗。", en:"The auto-renew job had been failing for three months: the API token it used for DNS validation was rotated, and its errors went to a log nobody read. When the certificate expired, every TLS connection failed."},
      todo:[
        {zh:"監控憑證本身的到期日，剩 14 天就告警", en:"Monitor the certificate's own expiry and alert at 14 days"},
        {zh:"續期 job 失敗要告警，不能只寫在 log 裡", en:"Alert when the renewal job fails, not just log it"},
        {zh:"輪替 token 的時候，列出所有用到它的地方", en:"When rotating a token, list everything that uses it"}
      ],
      lesson:{zh:"監控要盯結果（憑證還剩幾天），不是盯過程（續期 job 有沒有跑）。", en:"Monitor the outcome (days left on the certificate), not the process (whether the renewal job ran)."}
    }
  ];

  var GRADE_ORDER = "SABC";
  var SEV = {P1:"#FF453A", P2:"#FF9F0A", P3:"#8E8E93"};

  // The fastest path: on every step, the cheapest option that moves on or fixes.
  function par(s){
    return s.steps.reduce(function(sum, st){
      return sum + Math.min.apply(null, st.opts.filter(function(o){ return o.go || o.fix; }).map(function(o){ return o.min; }));
    }, 0);
  }
  function grade(s, mins, traps){
    var p = par(s);
    if (!traps && mins <= p + 2) return "S";
    if (traps <= 1 && mins <= p * 1.6) return "A";
    if (mins <= p * 2.5) return "B";
    return "C";
  }
  function loadBest(){ try { return JSON.parse(localStorage.getItem("oncall.best")) || {}; } catch (e) { return {}; } }
  function saveBest(b){ try { localStorage.setItem("oncall.best", JSON.stringify(b)); } catch (e) {} }

  TankOS.define("oncall", {
    i18n: {
      "oc.lede":   {zh:"半夜手機響了。告警一則一則進來，每個動作都要花時間，有些還會讓事情更糟。修好之後，看看你的事故檢討。", en:"Your phone goes off in the middle of the night. Alerts keep coming, every action costs time, and some make things worse. Fix it, then read your postmortem."},
      "oc.pick":   {zh:"選一個事故", en:"Pick an incident"},
      "oc.random": {zh:"隨機來一個", en:"Surprise me"},
      "oc.best":   {zh:"最佳 {g}", en:"Best {g}"},
      "oc.time":   {zh:"時間", en:"Time"},
      "oc.status": {zh:"狀態", en:"Status"},
      "oc.st.down":{zh:"異常", en:"Down"},
      "oc.st.part":{zh:"部分恢復", en:"Degraded"},
      "oc.st.up":  {zh:"已恢復", en:"Restored"},
      "oc.paged":  {zh:"手機響了：{n} 則告警", en:"Paged: {n} alerts"},
      "oc.did":    {zh:"你：{a}", en:"You: {a}"},
      "oc.cost":   {zh:"+{m} 分鐘", en:"+{m} min"},
      "oc.trap":   {zh:"這招沒用", en:"That didn't help"},
      "oc.quit":   {zh:"放棄，回到選單", en:"Give up and go back"},
      "oc.pm":     {zh:"事故檢討", en:"Postmortem"},
      "oc.pm.mttr":{zh:"修好花了", en:"Time to fix"},
      "oc.pm.min": {zh:"{m} 分鐘", en:"{m} min"},
      "oc.pm.par": {zh:"最快 {m} 分鐘", en:"fastest {m} min"},
      "oc.pm.grade":{zh:"評等", en:"Grade"},
      "oc.g.S":    {zh:"教科書等級", en:"Textbook"},
      "oc.g.A":    {zh:"很穩", en:"Steady hands"},
      "oc.g.B":    {zh:"修好了", en:"Fixed it"},
      "oc.g.C":    {zh:"天亮前修好了", en:"Fixed before sunrise"},
      "oc.pm.what":{zh:"你做了什麼", en:"What you did"},
      "oc.pm.traps":{zh:"踩到的陷阱", en:"Traps you fell into"},
      "oc.pm.none":{zh:"沒有，漂亮。", en:"None. Nicely done."},
      "oc.pm.egg": {zh:"另外，你去拜了綠色乖乖。", en:"Also, you made an offering to the green Kuai Kuai."},
      "oc.pm.cause":{zh:"真正的原因", en:"Root cause"},
      "oc.pm.path":{zh:"最快的處理順序（{m} 分鐘）", en:"The fastest path ({m} min)"},
      "oc.pm.todo":{zh:"事後要做", en:"Follow-ups"},
      "oc.pm.lesson":{zh:"一句話", en:"In one line"},
      "oc.again":  {zh:"再玩一次", en:"Play again"},
      "oc.other":  {zh:"換一個事故", en:"Another incident"}
    },

    css: [
      ".oc{padding:18px 20px 26px;font-size:13px;line-height:1.55}",
      ".oc-home[hidden],.oc-play[hidden],.oc-pm[hidden]{display:none}",
      ".oc-lede{color:var(--win-soft)}",
      ".oc h3{margin:20px 0 10px;font-size:12px;font-weight:600;color:var(--win-mute)}",
      ".oc-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}",
      ".oc-card{position:relative;display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:10px;text-align:left;background:var(--win-side);border:.5px solid var(--win-line);cursor:pointer}",
      ".oc-card:hover{border-color:var(--win-soft)}",
      ".oc-card b{font-size:13.5px}",
      ".oc-card small{color:var(--win-soft);font-size:12px}",
      ".oc-card i{font-style:normal;font:11px var(--mono);color:var(--win-mute)}",
      ".oc-card em{position:absolute;top:10px;right:10px;font-style:normal;font:600 11px var(--mono);padding:1px 6px;border-radius:5px;background:rgba(48,209,88,.16);color:#1F9D47}",
      ".oc-rand,.oc-btn{margin-top:14px;padding:6px 16px;border-radius:8px;border:.5px solid var(--win-line);background:var(--win-side);color:var(--win-fg);cursor:pointer}",
      ".oc-btn.pri{background:#E5484D;border-color:transparent;color:#fff;font-weight:600}",
      ".oc-bar{position:sticky;top:-18px;z-index:1;display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;margin:-18px -20px 0;padding:10px 20px;background:var(--win-bar);border-bottom:.5px solid var(--win-line)}",
      ".oc-bar b{font-size:13.5px;margin-right:auto}",
      ".oc-bar span{font-size:12px;color:var(--win-mute)}",
      ".oc-bar span strong{margin-left:6px;font:600 13px var(--mono);color:var(--win-fg);font-variant-numeric:tabular-nums}",
      ".oc-bar .down strong{color:#E5484D}",
      ".oc-bar .part strong{color:#D98200}",
      ".oc-bar .up strong{color:#1F9D47}",
      ".oc-log{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}",
      ".oc-log li{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:baseline}",
      ".oc-log time{font:11.5px var(--mono);color:var(--win-mute);font-variant-numeric:tabular-nums}",
      ".oc-log .al div{padding:7px 10px;border-radius:8px;background:rgba(229,72,77,.08);border-left:3px solid var(--sev)}",
      ".oc-log .al b{font:600 11px var(--mono);color:var(--sev);margin-right:8px}",
      ".oc-log .act div{font-weight:600}",
      ".oc-log .act small{margin-left:8px;font:11.5px var(--mono);color:var(--win-mute);font-weight:400}",
      ".oc-log .say div{color:var(--win-soft)}",
      ".oc-log .say.bad div{color:var(--win-fg)}",
      ".oc-log .say.bad div::before{content:attr(data-tag);display:inline-block;margin-right:8px;padding:0 6px;border-radius:5px;font-size:11px;font-weight:600;background:rgba(255,159,10,.18);color:#C46A00}",
      ".oc-log .sys div{font-size:12px;color:var(--win-mute)}",
      ".oc-ask{margin-top:18px;padding-top:14px;border-top:.5px solid var(--win-line)}",
      ".oc-q{font-weight:600;font-size:14px}",
      ".oc-opts{display:flex;flex-direction:column;gap:8px;margin-top:10px}",
      ".oc-opts button{display:block;padding:9px 12px;border-radius:9px;text-align:left;background:var(--win-side);border:.5px solid var(--win-line);color:var(--win-fg);cursor:pointer}",
      ".oc-opts button:hover:not(:disabled){border-color:var(--win-soft)}",
      ".oc-opts button:disabled{opacity:.45;cursor:default;text-decoration:line-through}",
      ".oc-quit{margin-top:14px;font-size:12px;color:var(--win-mute);text-decoration:underline;cursor:pointer}",
      ".oc-head{display:flex;align-items:center;gap:16px}",
      ".oc-grade{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:14px;font:700 34px var(--mono);color:#fff}",
      ".oc-grade.S{background:linear-gradient(160deg,#FFD84D,#E0A100)}",
      ".oc-grade.A{background:linear-gradient(160deg,#5BE37D,#1F9D47)}",
      ".oc-grade.B{background:linear-gradient(160deg,#64D2FF,#0A84FF)}",
      ".oc-grade.C{background:linear-gradient(160deg,#A1A1A6,#636366)}",
      ".oc-head h2{font-size:17px}",
      ".oc-head p{color:var(--win-soft)}",
      ".oc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:16px}",
      ".oc-stats div{padding:10px 12px;border-radius:9px;background:var(--win-side);border:.5px solid var(--win-line)}",
      ".oc-stats small{display:block;font-size:11.5px;color:var(--win-mute)}",
      ".oc-stats b{font:600 16px var(--mono);font-variant-numeric:tabular-nums}",
      ".oc-stats i{display:block;font-style:normal;font-size:11.5px;color:var(--win-mute)}",
      ".oc-pm ol,.oc-pm ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px}",
      ".oc-pm ol time{font:11.5px var(--mono);color:var(--win-mute);margin-right:8px}",
      ".oc-pm li.trap{color:#C46A00}",
      ".oc-lesson{margin-top:6px;padding:10px 14px;border-radius:8px;background:rgba(229,72,77,.08);font-weight:600}",
      ".oc-end{display:flex;gap:10px;flex-wrap:wrap}"
    ].join("\n"),

    html:
      '<div class="body oc">' +
        '<section class="oc-home">' +
          '<p class="oc-lede" data-i18n="oc.lede"></p>' +
          '<h3 data-i18n="oc.pick"></h3>' +
          '<div class="oc-cards"></div>' +
          '<button type="button" class="oc-rand" data-i18n="oc.random"></button>' +
        '</section>' +
        '<section class="oc-play" hidden>' +
          '<div class="oc-bar"><b class="oc-name"></b><span class="oc-clock"></span><span class="oc-meter"></span><span class="oc-st"></span></div>' +
          '<ol class="oc-log"></ol>' +
          '<div class="oc-ask"><p class="oc-q"></p><div class="oc-opts"></div><button type="button" class="oc-quit" data-i18n="oc.quit"></button></div>' +
        '</section>' +
        '<section class="oc-pm" hidden></section>' +
      '</div>',

    init: function(el, os){
      var home = el.querySelector(".oc-home"), play = el.querySelector(".oc-play"), pm = el.querySelector(".oc-pm");
      var cards = el.querySelector(".oc-cards"), log = el.querySelector(".oc-log"), q = el.querySelector(".oc-q"), opts = el.querySelector(".oc-opts");
      var bar = {name:el.querySelector(".oc-name"), clock:el.querySelector(".oc-clock"), meter:el.querySelector(".oc-meter"), st:el.querySelector(".oc-st")};
      // One game: the scenario, where you are, and everything that happened, so a language switch can redraw it.
      var g = null;

      function L(o){ return o[os.lang() === "en" ? "en" : "zh"]; }
      function num(n){ return new Intl.NumberFormat(os.lang() === "en" ? "en-US" : "zh-TW").format(Math.round(n)); }
      function clockAt(s, mins){
        var p = s.clock.split(":"), t = (+p[0] * 60 + +p[1] + mins) % 1440;
        return ("0" + Math.floor(t / 60)).slice(-2) + ":" + ("0" + t % 60).slice(-2);
      }
      function make(tag, cls, text){
        var x = document.createElement(tag);
        if (cls) x.className = cls;
        if (text != null) x.textContent = text;
        return x;
      }
      function scrollEnd(){ el.scrollTop = el.scrollHeight; }

      function drawHome(){
        var best = loadBest();
        cards.textContent = "";
        SCN.forEach(function(s){
          var c = make("button", "oc-card");
          c.type = "button";
          c.appendChild(make("i", "", s.clock));
          c.appendChild(make("b", "", L(s.name)));
          c.appendChild(make("small", "", L(s.hook)));
          if (best[s.id]) c.appendChild(make("em", "", os.fill(os.t("oc.best"), {g:best[s.id]})));
          c.addEventListener("click", function(){ start(s); });
          cards.appendChild(c);
        });
      }

      function start(s){
        g = {s:s, step:0, mins:0, meter:0, rate:s.rate, used:{}, events:[], done:false};
        g.events.push({k:"sys", t:0, key:"oc.paged", vars:{n:s.alerts.length}});
        s.alerts.forEach(function(a){ g.events.push({k:"al", t:0, a:a}); });
        home.hidden = true; pm.hidden = true; play.hidden = false;
        drawPlay();
        el.scrollTop = 0;
      }

      function choose(o, i){
        var key = g.step + ":" + i;
        g.events.push({k:"act", t:g.mins, o:o});
        g.mins += o.min;
        g.meter += g.rate * o.min + (o.hit || 0);
        if (o.rate != null) g.rate = o.rate;
        g.events.push({k:"say", t:g.mins, o:o});
        if (o.fix) { g.done = true; g.rate = 0; finish(); return; }
        if (o.go) g.step++;
        else g.used[key] = true;
        drawPlay();
        scrollEnd();
      }

      function status(){
        return g.done ? "up" : g.rate < g.s.rate ? "part" : "down";
      }

      function drawPlay(){
        var s = g.s, st = s.steps[g.step], stt = status();
        bar.name.textContent = L(s.name);
        bar.clock.innerHTML = "";
        bar.clock.appendChild(document.createTextNode(os.t("oc.time")));
        bar.clock.appendChild(make("strong", "", clockAt(s, g.mins)));
        bar.meter.textContent = L(s.meter);
        bar.meter.appendChild(make("strong", "", num(g.meter)));
        bar.st.className = stt;
        bar.st.textContent = os.t("oc.status");
        bar.st.appendChild(make("strong", "", os.t("oc.st." + stt)));

        log.textContent = "";
        g.events.forEach(function(e){
          var li = make("li", e.k), body = make("div");
          li.appendChild(make("time", "", e.k === "act" || e.k === "sys" || e.k === "al" ? clockAt(s, e.t) : ""));
          if (e.k === "sys") body.textContent = os.fill(os.t(e.key), e.vars);
          if (e.k === "al") {
            li.style.setProperty("--sev", SEV[e.a.sev]);
            body.appendChild(make("b", "", e.a.sev));
            body.appendChild(document.createTextNode(L(e.a.text)));
          }
          if (e.k === "act") {
            body.textContent = os.fill(os.t("oc.did"), {a:L(e.o.label)});
            body.appendChild(make("small", "", os.fill(os.t("oc.cost"), {m:e.o.min})));
          }
          if (e.k === "say") {
            body.textContent = L(e.o.say);
            if (e.o.trap) { li.classList.add("bad"); body.setAttribute("data-tag", os.t("oc.trap")); }
          }
          li.appendChild(body);
          log.appendChild(li);
        });

        q.textContent = L(st.ask);
        opts.textContent = "";
        st.opts.forEach(function(o, i){
          var b = make("button");
          b.type = "button";
          // The cost only shows in the channel afterwards; on the button it would give the traps away.
          b.appendChild(make("span", "", L(o.label)));
          b.disabled = !!g.used[g.step + ":" + i];
          b.addEventListener("click", function(){ choose(o, i); });
          opts.appendChild(b);
        });
      }

      function finish(){
        var s = g.s, traps = g.events.filter(function(e){ return e.k === "act" && e.o.trap; });
        var gr = grade(s, g.mins, traps.length), best = loadBest();
        if (!best[s.id] || GRADE_ORDER.indexOf(gr) < GRADE_ORDER.indexOf(best[s.id])) { best[s.id] = gr; saveBest(best); }
        g.grade = gr;
        drawPm();
        play.hidden = true; pm.hidden = false;
        el.scrollTop = 0;
      }

      function section(title){ pm.appendChild(make("h3", "", title)); }

      function drawPm(){
        var s = g.s, acts = g.events.filter(function(e){ return e.k === "act"; });
        var traps = acts.filter(function(e){ return e.o.trap; }), egg = acts.some(function(e){ return e.o.egg; });
        pm.textContent = "";

        var head = make("div", "oc-head"), txt = make("div");
        head.appendChild(make("div", "oc-grade " + g.grade, g.grade));
        txt.appendChild(make("h2", "", os.t("oc.pm") + " · " + L(s.name)));
        txt.appendChild(make("p", "", os.t("oc.g." + g.grade)));
        head.appendChild(txt);
        pm.appendChild(head);

        var stats = make("div", "oc-stats");
        [[os.t("oc.pm.mttr"), os.fill(os.t("oc.pm.min"), {m:g.mins}), os.fill(os.t("oc.pm.par"), {m:par(s)})],
         [L(s.meter), num(g.meter), ""],
         [os.t("oc.pm.traps"), String(traps.length), ""]
        ].forEach(function(r){
          var d = make("div");
          d.appendChild(make("small", "", r[0]));
          d.appendChild(make("b", "", r[1]));
          if (r[2]) d.appendChild(make("i", "", r[2]));
          stats.appendChild(d);
        });
        pm.appendChild(stats);

        section(os.t("oc.pm.what"));
        var ol = make("ol");
        acts.forEach(function(e){
          var li = make("li", e.o.trap ? "trap" : "");
          li.appendChild(make("time", "", clockAt(s, e.t)));
          li.appendChild(document.createTextNode(L(e.o.label)));
          ol.appendChild(li);
        });
        pm.appendChild(ol);

        section(os.t("oc.pm.traps"));
        if (traps.length) {
          var ul = make("ul");
          traps.forEach(function(e){ ul.appendChild(make("li", "", L(e.o.label) + " — " + L(e.o.say))); });
          pm.appendChild(ul);
        } else pm.appendChild(make("p", "", os.t("oc.pm.none")));
        if (egg) pm.appendChild(make("p", "", os.t("oc.pm.egg")));

        section(os.t("oc.pm.cause"));
        pm.appendChild(make("p", "", L(s.cause)));

        section(os.fill(os.t("oc.pm.path"), {m:par(s)}));
        var path = make("ol");
        s.steps.forEach(function(st){
          var o = st.opts.filter(function(x){ return x.go || x.fix; }).sort(function(a, b){ return a.min - b.min; })[0];
          path.appendChild(make("li", "", L(o.label)));
        });
        pm.appendChild(path);

        section(os.t("oc.pm.todo"));
        var todo = make("ul");
        s.todo.forEach(function(t){ todo.appendChild(make("li", "", L(t))); });
        pm.appendChild(todo);

        section(os.t("oc.pm.lesson"));
        pm.appendChild(make("p", "oc-lesson", L(s.lesson)));

        var end = make("div", "oc-end"), again = make("button", "oc-btn pri", os.t("oc.again")), other = make("button", "oc-btn", os.t("oc.other"));
        again.type = other.type = "button";
        again.addEventListener("click", function(){ start(s); });
        other.addEventListener("click", goHome);
        end.appendChild(again);
        end.appendChild(other);
        pm.appendChild(end);
      }

      function goHome(){
        g = null;
        play.hidden = true; pm.hidden = true; home.hidden = false;
        drawHome();
        el.scrollTop = 0;
      }

      el.querySelector(".oc-rand").addEventListener("click", function(){ start(SCN[Math.floor(Math.random() * SCN.length)]); });
      el.querySelector(".oc-quit").addEventListener("click", goHome);
      var off = os.onLang(function(){
        if (!g) drawHome();
        else if (g.done) drawPm();
        else drawPlay();
      });
      drawHome();
      return off;
    }
  });
})();
