// 凌晨三點 (3 A.M.), the on-call game. A small top-down RPG: woken at night by alerts, you walk your character
// around a flat to the phone, the laptop and the rack, and each action there costs simulated minutes, some of
// them making things worse. Fixed, you go back to bed for an ending that depends on the grade, then the
// postmortem (time to fix, traps hit, the fastest path, follow-ups). Opening the app starts a random incident,
// preferring ones not played yet. Pure front end; the best grade and the incidents seen stay in this browser
// (localStorage "oncall.best", "oncall.seen"). index.html loads this file the first time the window opens.
(function(){
  // Steps run in order. An option either moves on (go), ends the incident (fix), or leaves you on the same step
  // and is greyed out (a trap, the egg, or a half-measure). min is the simulated minutes it costs; the meter
  // grows by `rate` per minute plus any `hit`; `rate` on an option replaces the rate from then on. `at` is where
  // in the flat you do it: the laptop (default), the phone, or the rack.
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
          {min:10, go:1, at:"phone", label:{zh:"叫醒 DBA", en:"Wake up the DBA"},
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
          {min:12, go:1, at:"phone", label:{zh:"叫醒寫這支排程的同事", en:"Wake the engineer who wrote the job"},
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
          {min:10, go:1, at:"phone", label:{zh:"請合作夥伴清快取再重試", en:"Ask the partner to clear their cache and retry"},
           say:{zh:"對方 10 分鐘後回覆：「我們這邊看到的是 certificate has expired。」", en:"Ten minutes later they reply: \"We're seeing certificate has expired.\""}},
          {min:8, trap:1, label:{zh:"回滾今天的部署", en:"Roll back today's deploy"},
           say:{zh:"今天根本沒有部署。禮拜五不部署，這是祖訓。", en:"There was no deploy today. Nobody deploys on a Friday."}},
          {min:1, egg:1, at:"rack", label:{zh:"先去拜綠色乖乖", en:"Make an offering to the green Kuai Kuai first"},
           say:{zh:"綠色乖乖已經放上機櫃。可惜乖乖只保佑還沒過期的東西。", en:"A packet of green Kuai Kuai is on the rack. Sadly it only protects things that haven't expired yet."}}
        ]},
        {ask:{zh:"憑證過期了。可是今天是禮拜五……", en:"The certificate has expired. But it's Friday..."}, opts:[
          {min:10, fix:1, label:{zh:"手動續期，部署新憑證", en:"Renew it by hand and deploy the new certificate"},
           say:{zh:"新憑證部署上去，TLS 握手恢復，合作夥伴的 webhook 開始重送。", en:"The new certificate is live, TLS handshakes succeed, and partner webhooks start retrying."}},
          {min:15, trap:1, hit:300, at:"phone", label:{zh:"等禮拜一再說，禮拜五不部署", en:"Leave it until Monday. No Friday deploys"},
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

  /* ----- the flat for RPG mode ----- */
  var T = 16, MW = 20, MH = 12, CHAR = 0;   // CHAR: which RPG Urban character (rows CHAR..CHAR+2)
  var MAP = [
    "####################",
    "####################",
    "#........#.........#",
    "#........#.........#",
    "#........#.........#",
    "#........#.........#",
    "#..................#",
    "#..................#",
    "#........#.........#",
    "#........#.........#",
    "#........#.........#",
    "####################"
  ];
  var DIRS = {up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0]};
  var START = [2, 4], PHONE = [2, 2], PC = [11, 2], RACK = [18, 2], WIN = [4, 1];
  // Roguelike Indoors tiles by (column, row); c2/r2 is the lower half of a two-tile piece.
  var PROPS = [
    {art:"bed", x:1, y:2, h:2, block:1, dy:-1},                                       // bed, headboard to the wall (drawn here; the pack has none this size)
    {c:4, r:4, x:2, y:2, block:1},                                                    // nightstand, the phone sits on it
    {c:16, r:0, x:8, y:2, block:1},                                                   // plant
    {art:"window", x:4, y:1},
    {c:0, r:1, x:11, y:2, block:1}, {c:2, r:1, x:12, y:2, block:1},                    // desk; the laptop is drawn on it
    {c:1, r:2, x:11, y:3},                                                            // desk chair; you stand on it to use the laptop
    {c:19, r:17, x:15, y:2, block:1}, {c:20, r:17, x:16, y:2, block:1},                // bookshelf
    {c:19, r:12, x:13, y:1},                                                          // picture on the wall
    {x:18, y:2, h:2, block:1},                                                        // the rack, drawn live
    {c:17, r:0, x:18, y:10, block:1}                                                  // plant
  ];
  // What you can use, and where you stand (x, y, facing) to use it.
  var THINGS = [
    {id:"phone", tiles:[[2, 2]], spots:[[2, 3, "up"]]},
    {id:"bed", tiles:[[1, 2], [1, 3]], spots:[[1, 4, "up"], [2, 3, "left"]]},
    {id:"pc", tiles:[[11, 2], [12, 2]], spots:[[11, 3, "up"], [12, 3, "up"]]},
    {id:"shelf", tiles:[[15, 2], [16, 2]], spots:[[15, 3, "up"], [16, 3, "up"]]},
    {id:"rack", tiles:[[18, 2], [18, 3]], spots:[[17, 3, "right"], [18, 4, "up"], [17, 2, "right"]]}
  ];
  var PAL = {k:"#23252B", g:"#5A5F6B", l:"#A9AEB8", s:"#2F4A63", S:"#6C7A89", d:"#15161A", r:"#FF5050", G:"#3FD15A",
             y:"#FFD84D", w:"#F2F2F2", f:"#7A5C3E", b:"#1C2748", m:"#F4F1D0", t:"#9FB7E8", n:"#2BA84A",
             F:"#A47B52", W:"#DCD5C6", o:"#E07B39", O:"#C25E25"};
  var ART = {
    bed:[
      "..ffffffffffff..",
      ".fFFFFFFFFFFFFf.",
      ".fFFFFFFFFFFFFf.",
      ".fwwwwwwwwwwwwf.",
      ".fwWWWWWWWWWWwf.",
      ".fwWWWWWWWWWWwf.",
      ".fwwwwwwwwwwwwf.",
      ".foooooooooooof.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOoOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOoOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOoOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOoOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fOOOOOOOOOOOOf.",
      ".fooooooooooooof",
      ".ffffffffffffff.",
      ".fFFFFFFFFFFFFf.",
      ".ffffffffffffff.",
      "..f..........f.."],
    laptop:[
      "..kkkkkkkkkkkk..",
      "..kssssssssssk..",
      "..kssssssssssk..",
      "..kssssssssssk..",
      "..kssssssssssk..",
      "..kssssssssssk..",
      "..kkkkkkkkkkkk..",
      ".gllllllllllllg.",
      ".glgggggggggglg.",
      "gggggggggggggggg"],
    phone:[
      "................",
      "......kkkk......",
      "......kSSk......",
      "......kSSk......",
      "......kSSk......",
      "......kkkk......"],
    rack:[
      "..dddddddddddd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggrGd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggGrd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggGGd..",
      "..dkkkkkkkkkkd..",
      "..dkllllllllld..",
      "..dkllllllllld..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggrGd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggGGd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggGrd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggGGd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggrGd..",
      "..dkkkkkkkkkkd..",
      "..dkgggggggGGd..",
      "..dkkkkkkkkkkd..",
      "..dkllllllllld..",
      "..dkllllllllld..",
      "..dkkkkkkkkkkd..",
      "..dddddddddddd..",
      "..dd........dd.."],
    kuai:[
      "................",
      "......nnnn......",
      ".....nyyyyn.....",
      ".....nynnyn.....",
      ".....nyyyyn.....",
      ".....nnnnnn.....",
      ".....nnwwnn.....",
      ".....nnnnnn.....",
      "......nnnn......",
      "................",
      "................"],
    window:[
      "................................",
      "..ffffffffffffffffffffffffffff..",
      "..fbbbbbbbbbbbbfbbbbbbbbbbbbbf..",
      "..fbbbtbbbbbbbbfbbbbbbbbbmmbbf..",
      "..fbbbbbbbbbbbbfbbbbbbbbmmmmbf..",
      "..fbbbbbbbbtbbbfbbbbbbbbmmmmbf..",
      "..fbbbbbbbbbbbbfbbbbbbbbbmmbbf..",
      "..fbtbbbbbbbbbbfbbbtbbbbbbbbbf..",
      "..fbbbbbbbbbbbbfbbbbbbbbbbbbbf..",
      "..fbbbbbbbbbbtbfbbbbbbbbbtbbbf..",
      "..ffffffffffffffffffffffffffff..",
      "................................"]
  };
  var IMG = {};

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

  // Which incident to open: one not played yet if any, never the one just played.
  function loadSeen(){ try { return JSON.parse(localStorage.getItem("oncall.seen")) || []; } catch (e) { return []; } }
  function pick(not){
    var seen = loadSeen(), pool = SCN.filter(function(s){ return s.id !== not && seen.indexOf(s.id) < 0; });
    if (!pool.length) pool = SCN.filter(function(s){ return s.id !== not; });
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function markSeen(id){
    var seen = loadSeen();
    if (seen.indexOf(id) < 0) seen.push(id);
    if (seen.length >= SCN.length) seen = [id];   // all played: start a new round, but not with this one
    try { localStorage.setItem("oncall.seen", JSON.stringify(seen)); } catch (e) {}
  }

  TankOS.define("oncall", {
    i18n: {
      "oc.shift":  {zh:"值班中", en:"On call"},
      "oc.time":   {zh:"時間", en:"Time"},
      "oc.status": {zh:"狀態", en:"Status"},
      "oc.st.down":{zh:"異常", en:"Down"},
      "oc.st.part":{zh:"部分恢復", en:"Degraded"},
      "oc.st.up":  {zh:"已恢復", en:"Restored"},
      "oc.paged":  {zh:"手機響了：{n} 則告警", en:"Paged: {n} alerts"},
      "oc.did":    {zh:"你：{a}", en:"You: {a}"},
      "oc.cost":   {zh:"+{m} 分鐘", en:"+{m} min"},
      "oc.trap":   {zh:"這招沒用", en:"That didn't help"},
      "oc.pm":     {zh:"事故檢討", en:"Postmortem"},
      "oc.pm.mttr":{zh:"修好花了", en:"Time to fix"},
      "oc.pm.min": {zh:"{m} 分鐘", en:"{m} min"},
      "oc.pm.par": {zh:"最快 {m} 分鐘", en:"fastest {m} min"},
      "oc.pm.what":{zh:"你做了什麼", en:"What you did"},
      "oc.pm.traps":{zh:"踩到的陷阱", en:"Traps you fell into"},
      "oc.pm.none":{zh:"沒有，漂亮。", en:"None. Nicely done."},
      "oc.pm.egg": {zh:"另外，你去拜了綠色乖乖。", en:"Also, you made an offering to the green Kuai Kuai."},
      "oc.pm.cause":{zh:"真正的原因", en:"Root cause"},
      "oc.pm.path":{zh:"最快的處理順序（{m} 分鐘）", en:"The fastest path ({m} min)"},
      "oc.pm.todo":{zh:"事後要做", en:"Follow-ups"},
      "oc.pm.lesson":{zh:"一句話", en:"In one line"},
      "oc.again":  {zh:"同一個事故再玩一次", en:"Replay this incident"},
      "oc.next":   {zh:"再來一局", en:"Next incident"},
      "oc.credit": {zh:"像素素材：Kenney（kenney.nl，CC0）", en:"Pixel art: Kenney (kenney.nl, CC0)"},
      "end.title": {zh:"結局 {g}：{name}", en:"Ending {g}: {name}"},
      "end.S":     {zh:"一夜好眠", en:"A good night's sleep"},
      "end.A":     {zh:"大杯咖啡", en:"A large coffee"},
      "end.B":     {zh:"站會主角", en:"Star of the stand-up"},
      "end.C":     {zh:"天亮了", en:"Sunrise"},
      "end.S.t":   {zh:"{m} 分鐘收工，一個陷阱都沒踩。回到床上，剛剛那個夢還接得上。早上群組裡，主管只留了一句：「昨晚處理得漂亮。」", en:"Done in {m} minutes without a single trap. Back in bed, the dream picks up where it left off. In the morning your manager posts one line: \"Nicely handled last night.\""},
      "end.A.t":   {zh:"{m} 分鐘修好，判斷大致都對。睡得不算多，但鬧鐘響的時候你還記得自己是誰。今天的咖啡點大杯。", en:"Fixed in {m} minutes, mostly the right calls. Not much sleep, but when the alarm goes off you still know who you are. Make today's coffee a large."},
      "end.B.t":   {zh:"修好了，只是繞了點路，花了 {m} 分鐘。早上站會，大家都想聽昨晚發生什麼事。下午記得寫事故檢討。", en:"Fixed, after a detour: {m} minutes. At stand-up everyone wants the story of last night. Write the postmortem this afternoon."},
      "end.C.t":   {zh:"修好的時候天已經亮了，前後 {m} 分鐘。你在早餐店收到一則訊息：「今天下午開個會，聊聊昨晚。」", en:"By the time it's fixed the sun is up: {m} minutes in all. At the breakfast shop a message arrives: \"Let's meet this afternoon about last night.\""},
      "end.was":   {zh:"這次的事故：{name}", en:"This time: {name}"},
      "end.stats": {zh:"修好花了 {m} 分鐘 · 踩到 {n} 個陷阱 · {meter} {v}", en:"{m} min to fix · {n} traps · {meter} {v}"},
      "end.pm":    {zh:"看事故檢討", en:"Read the postmortem"},
      "rpg.loading":{zh:"載入中…", en:"Loading…"},
      "rpg.loadFail":{zh:"圖檔載入失敗，重新整理再試一次。", en:"Couldn't load the graphics. Reload and try again."},
      "rpg.close": {zh:"關閉", en:"Close"},
      "rpg.book":  {zh:"紀錄", en:"Log"},
      "rpg.bookKey":{zh:"紀錄（J）", en:"Log (J)"},
      "rpg.restart":{zh:"重新開始", en:"Restart"},
      "rpg.restartTip":{zh:"換一個隨機事故", en:"Start a different random incident"},
      "rpg.empty": {zh:"還沒有任何紀錄。", en:"Nothing logged yet."},
      "rpg.wake":  {zh:"{t}。床頭的手機一直在震……\n（方向鍵或 WASD 移動，空白鍵互動，J 看紀錄；也可以直接點地板或東西）", en:"{t}. The phone by the bed won't stop buzzing...\n(Arrow keys or WASD to move, Space to interact, J for the log, or just click the floor or things.)"},
      "rpg.phoneFirst":{zh:"手機還在響，先接起來看看。", en:"The phone is still ringing. Answer it first."},
      "rpg.answer":{zh:"是告警，{n} 則。", en:"Alerts. {n} of them."},
      "rpg.goalPhone":{zh:"目標：接起床頭的手機", en:"Goal: answer the phone by the bed"},
      "rpg.goal":  {zh:"目標：{ask}　可以去：{where}", en:"Goal: {ask}  Go to: {where}"},
      "rpg.goalBed":{zh:"目標：回床上睡覺", en:"Goal: back to bed"},
      "rpg.at.pc": {zh:"筆電", en:"Laptop"},
      "rpg.at.phone":{zh:"手機", en:"Phone"},
      "rpg.at.rack":{zh:"機櫃", en:"Rack"},
      "rpg.nothing":{zh:"這一步在這裡沒什麼能做的。可以去：{where}", en:"Nothing to do here for this step. Try: {where}"},
      "rpg.bedEarly":{zh:"現在不是睡覺的時候。", en:"This is no time for sleep."},
      "rpg.shelf": {zh:"《資料密集型應用系統設計》《SRE：Google 運維解密》……現在不是看書的時候。", en:"Designing Data-Intensive Applications, Site Reliability Engineering... this is no time for reading."},
      "rpg.rack":  {zh:"家裡的小機櫃，上面供著一包綠色乖乖。這次用不到它。", en:"The little rack at home, a packet of green Kuai Kuai on top. Not needed this time."},
      "rpg.fixed": {zh:"修好了。可以回床上睡覺了。", en:"Fixed. Time to go back to bed."},
      "rpg.goBed": {zh:"事情處理完了，回床上睡覺吧。", en:"It's handled. Go back to bed."}
    },

    css: [
      ".oc{container-type:inline-size;padding:18px 20px 26px;font-size:13px;line-height:1.55}",
      ".oc-rpg[hidden],.oc-pm[hidden],.oc-bar[hidden]{display:none}",
      ".oc h3{margin:20px 0 10px;font-size:12px;font-weight:600;color:var(--win-mute)}",
      ".oc-btn{margin-top:14px;padding:6px 16px;border-radius:8px;border:.5px solid var(--win-line);background:var(--win-side);color:var(--win-fg);cursor:pointer}",
      ".oc-btn.pri{background:#E5484D;border-color:transparent;color:#fff;font-weight:600}",
      ".oc-bar{position:sticky;top:-18px;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;margin:-18px -20px 0;padding:10px 20px;background:var(--win-bar);border-bottom:.5px solid var(--win-line)}",
      ".oc-bar b{font-size:13.5px;margin-right:auto}",
      ".oc-bar span{font-size:12px;color:var(--win-mute)}",
      ".oc-bar span strong{margin-left:6px;font:600 13px var(--mono);color:var(--win-fg);font-variant-numeric:tabular-nums}",
      ".oc-bar .down strong{color:#E5484D}",
      ".oc-bar .part strong{color:#D98200}",
      ".oc-bar .up strong{color:#1F9D47}",
      // The incident channel, used for the in-game log.
      ".oc-log{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}",
      ".oc-log li{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:baseline}",
      ".oc-log time{font:11.5px var(--mono);opacity:.6;font-variant-numeric:tabular-nums}",
      ".oc-log .al div{padding:6px 10px;border-radius:7px;background:rgba(229,72,77,.12);border-left:3px solid var(--sev)}",
      ".oc-log .al b{font:600 11px var(--mono);color:var(--sev);margin-right:8px}",
      ".oc-log .act div{font-weight:600}",
      ".oc-log .act small{margin-left:8px;font:11.5px var(--mono);opacity:.6;font-weight:400}",
      ".oc-log .say div{opacity:.85}",
      ".oc-log .say.bad div::before{content:attr(data-tag);display:inline-block;margin-right:8px;padding:0 6px;border-radius:5px;font-size:11px;font-weight:600;background:rgba(255,159,10,.22);color:#E08A00}",
      ".oc-log .sys div{font-size:12px;opacity:.6}",
      ".oc-stage{position:relative;margin-top:14px;border-radius:10px;overflow:hidden;background:#0B0C18}",
      ".oc-cv{display:block;width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges;outline:none;cursor:pointer;touch-action:manipulation}",
      ".oc-cv:focus-visible{box-shadow:inset 0 0 0 2px var(--sel)}",
      ".oc-hud{position:absolute;top:8px;right:8px;z-index:1;display:flex;gap:6px}",
      ".oc-hud button{padding:3px 10px;border-radius:6px;background:rgba(14,16,38,.72);border:1px solid rgba(232,219,190,.5);color:#F5EEDC;font-size:12px;cursor:pointer}",
      ".oc-hud button:hover{background:rgba(14,16,38,.92)}",
      ".oc-load{position:absolute;inset:0;display:grid;place-items:center;color:#C8C8D8;font-size:13px}",
      ".oc-load[hidden],.oc-say[hidden],.oc-panel[hidden],.oc-book[hidden],.oc-end[hidden]{display:none}",
      ".oc-say{position:absolute;left:8px;right:8px;bottom:8px;z-index:3;padding:10px 14px 14px;border-radius:8px;background:rgba(14,16,38,.94);border:2px solid #E8DBBE;color:#F5EEDC;font-size:13.5px;line-height:1.6;cursor:pointer}",
      ".oc-say p{white-space:pre-line}",
      ".oc-say small{position:absolute;right:10px;bottom:3px;font-size:10px;animation:oc-blink 1s steps(2) infinite}",
      "@keyframes oc-blink{50%{opacity:0}}",
      // The laptop is a terminal, the phone a phone; both keep everything done there, newest at the bottom.
      ".oc-panel,.oc-book{position:absolute;inset:6% 7%;z-index:3;display:flex;flex-direction:column;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}",
      ".oc-panel{background:#0E1116;border:2px solid #3A3F4B;color:#C8F7C5;font:12.5px/1.55 var(--mono)}",
      ".oc-panel header,.oc-book header{flex:none;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(127,127,127,.12)}",
      ".oc-panel .oc-x,.oc-book .oc-x{font-size:12px;color:inherit;opacity:.75;cursor:pointer}",
      ".oc-po{flex:1;min-height:0;overflow:auto;padding:8px 12px;white-space:pre-wrap}",
      ".oc-po .cmd{margin-top:8px;color:#7FDBFF}",
      ".oc-po .cmd:first-child{margin-top:0}",
      ".oc-po .bad::before{content:attr(data-tag);margin-right:8px;padding:0 6px;border-radius:5px;font-size:11px;background:rgba(255,159,10,.25);color:#FFB340}",
      ".oc-po .q{margin-top:10px;color:#FFD84D}",
      ".oc-po .q:first-child{margin-top:0}",
      ".oc-pa{flex:none;display:flex;flex-direction:column;gap:6px;padding:8px 12px 12px;max-height:50%;overflow:auto;border-top:1px solid rgba(127,127,127,.25)}",
      ".oc-pa button{text-align:left;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:inherit;font:inherit;cursor:pointer}",
      ".oc-pa button:hover,.oc-pa button:focus-visible{background:rgba(127,219,255,.16);outline:none}",
      ".oc-pa .none{opacity:.7}",
      ".oc-pa[hidden]{display:none}",
      ".oc-panel.phone{inset:5% 28%;border-radius:20px;border:4px solid #1C1C1E;background:#F4F4F7;color:#1D1D1F;font-family:var(--sys)}",
      ".oc-panel.phone .oc-po .q{color:#B25000}",
      ".oc-panel.phone .oc-po .cmd{color:#0A64D8}",
      ".oc-panel.phone .oc-pa button{background:#fff;border-color:#D8D8DE}",
      ".oc-book{background:#F6F0E1;color:#2A2418;border:3px solid #7A5C3E;font-size:12.5px}",
      ".oc-book ol{flex:1;min-height:0;overflow:auto;padding:10px 14px}",
      ".oc-book .none{opacity:.6}",
      // The ending card, over the morning scene.
      ".oc-end{position:absolute;inset:0;z-index:4;display:grid;place-items:center;padding:16px;background:rgba(10,10,24,.55);animation:oc-in .5s ease-out}",
      "@keyframes oc-in{from{opacity:0}}",
      ".oc-endcard{width:min(440px,100%);padding:18px 20px;border-radius:10px;background:#1A1C30;border:3px solid #E8DBBE;color:#F5EEDC;text-align:center}",
      ".oc-endcard .end{font:700 13px var(--mono);letter-spacing:6px;color:#FFD84D}",
      ".oc-endcard .gr{display:grid;place-items:center;width:58px;height:58px;margin:10px auto;border-radius:12px;font:700 30px var(--mono);color:#fff}",
      ".oc-endcard h2{font-size:17px}",
      ".oc-endcard p{margin-top:8px;color:#D9D2C0}",
      ".oc-endcard .was{margin-top:12px;font-weight:600;color:#FFD84D}",
      ".oc-endcard .st{font:12px var(--mono);color:#A9A391}",
      ".oc-endcard .row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}",
      ".gr.S,.oc-grade.S{background:linear-gradient(160deg,#FFD84D,#E0A100)}",
      ".gr.A,.oc-grade.A{background:linear-gradient(160deg,#5BE37D,#1F9D47)}",
      ".gr.B,.oc-grade.B{background:linear-gradient(160deg,#64D2FF,#0A84FF)}",
      ".gr.C,.oc-grade.C{background:linear-gradient(160deg,#A1A1A6,#636366)}",
      ".oc-goal{margin-top:10px;font-size:12.5px;color:var(--win-soft)}",
      // Narrow windows (phones): the map is too short to cover, so the panels, log and dialog sit under it.
      "@container (max-width:520px){.oc-panel,.oc-panel.phone,.oc-book,.oc-say{position:static;margin:8px}.oc-pa{max-height:none}.oc-po,.oc-book ol{max-height:260px}.oc-panel.phone{border-radius:14px}.oc-end{position:static;padding:8px;background:none}}",
      // Postmortem
      ".oc-head{display:flex;align-items:center;gap:16px}",
      ".oc-grade{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:14px;font:700 34px var(--mono);color:#fff}",
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
      ".oc-credit{margin-top:14px;font-size:11.5px;color:var(--win-mute)}",
      ".oc-endrow{display:flex;gap:10px;flex-wrap:wrap}"
    ].join("\n"),

    html:
      '<div class="body oc">' +
        '<div class="oc-bar" hidden><b class="oc-name" data-i18n="oc.shift"></b><span class="oc-clock"></span><span class="oc-meter"></span><span class="oc-st"></span></div>' +
        '<section class="oc-rpg">' +
          '<div class="oc-stage">' +
            '<canvas class="oc-cv" width="320" height="192" tabindex="0"></canvas>' +
            '<div class="oc-hud"><button type="button" class="oc-logb" data-i18n="rpg.bookKey"></button><button type="button" class="oc-re" data-i18n="rpg.restart" data-i18n-title="rpg.restartTip"></button></div>' +
            '<div class="oc-load" data-i18n="rpg.loading"></div>' +
            '<div class="oc-panel" hidden><header><b></b><button type="button" class="oc-x" data-i18n="rpg.close"></button></header><div class="oc-po"></div><div class="oc-pa"></div></div>' +
            '<div class="oc-book" hidden><header><b data-i18n="rpg.book"></b><button type="button" class="oc-x" data-i18n="rpg.close"></button></header><ol class="oc-log"></ol></div>' +
            '<div class="oc-say" hidden><p></p><small>▼</small></div>' +
            '<div class="oc-end" hidden><div class="oc-endcard"></div></div>' +
          '</div>' +
          '<p class="oc-goal"></p>' +
        '</section>' +
        '<section class="oc-pm" hidden></section>' +
      '</div>',

    init: function(el, os){
      var rpgEl = el.querySelector(".oc-rpg"), pm = el.querySelector(".oc-pm"), barEl = el.querySelector(".oc-bar");
      var bar = {clock:el.querySelector(".oc-clock"), meter:el.querySelector(".oc-meter"), st:el.querySelector(".oc-st")};
      var cv = el.querySelector(".oc-cv"), cx = cv.getContext("2d"), loadEl = el.querySelector(".oc-load");
      var sayEl = el.querySelector(".oc-say"), panel = el.querySelector(".oc-panel"), book = el.querySelector(".oc-book");
      var bookList = book.querySelector(".oc-log"), endEl = el.querySelector(".oc-end"), goalEl = el.querySelector(".oc-goal");
      // One game: the scenario, where you are, and everything that happened, so a language switch can redraw it.
      var g = null, rpg = null;

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
      function where(){ return stationsNow().map(function(a){ return os.t("rpg.at." + a); }).join(" · "); }

      function start(s){
        stopRpg();
        markSeen(s.id);
        // Options are shuffled each game: in the data the right answer tends to come first.
        var order = s.steps.map(function(st){
          var a = st.opts.map(function(_, i){ return i; });
          for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
          return a;
        });
        g = {s:s, step:0, mins:0, meter:0, rate:s.rate, used:{}, events:[], done:false, order:order};
        g.events.push({k:"sys", t:0, key:"oc.paged", vars:{n:s.alerts.length}});
        s.alerts.forEach(function(a){ g.events.push({k:"al", t:0, a:a}); });
        pm.hidden = true; rpgEl.hidden = false; barEl.hidden = false;
        el.scrollTop = 0;
        startRpg();
      }

      function choose(o, i){
        var key = g.step + ":" + i;
        g.events.push({k:"act", t:g.mins, o:o});
        g.mins += o.min;
        g.meter += g.rate * o.min + (o.hit || 0);
        if (o.rate != null) g.rate = o.rate;
        g.events.push({k:"say", t:g.mins, o:o});
        if (o.fix) { g.done = true; g.rate = 0; }
        else if (o.go) g.step++;
        else g.used[key] = true;
        rpgAfter(o);
      }

      function status(){ return g.done ? "up" : g.rate < g.s.rate ? "part" : "down"; }

      function drawBar(){
        var stt = status();
        bar.clock.textContent = os.t("oc.time");
        bar.clock.appendChild(make("strong", "", clockAt(g.s, g.mins)));
        bar.meter.textContent = L(g.s.meter);
        bar.meter.appendChild(make("strong", "", num(g.meter)));
        bar.st.className = stt;
        bar.st.textContent = os.t("oc.status");
        bar.st.appendChild(make("strong", "", os.t("oc.st." + stt)));
      }

      // The incident channel: alerts (once the phone is answered), what you did, what came back.
      function drawLog(list){
        var s = g.s;
        list.textContent = "";
        g.events.forEach(function(e){
          if ((e.k === "sys" || e.k === "al") && !rpg.answered) return;
          var li = make("li", e.k), body = make("div");
          li.appendChild(make("time", "", e.k === "say" ? "" : clockAt(s, e.t)));
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
          list.appendChild(li);
        });
        if (!list.children.length) list.appendChild(make("li", "none", os.t("rpg.empty")));
      }

      function result(){
        var traps = g.events.filter(function(e){ return e.k === "act" && e.o.trap; }).length;
        return {traps:traps, grade:grade(g.s, g.mins, traps)};
      }

      function section(title){ pm.appendChild(make("h3", "", title)); }

      function drawPm(){
        var s = g.s, acts = g.events.filter(function(e){ return e.k === "act"; });
        var traps = acts.filter(function(e){ return e.o.trap; }), egg = acts.some(function(e){ return e.o.egg; });
        pm.textContent = "";

        var head = make("div", "oc-head"), txt = make("div");
        head.appendChild(make("div", "oc-grade " + g.grade, g.grade));
        txt.appendChild(make("h2", "", os.t("oc.pm") + " · " + L(s.name)));
        txt.appendChild(make("p", "", os.fill(os.t("end.title"), {g:g.grade, name:os.t("end." + g.grade)})));
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
        pm.appendChild(make("p", "oc-credit", os.t("oc.credit")));

        var end = make("div", "oc-endrow"), next = make("button", "oc-btn pri", os.t("oc.next")), again = make("button", "oc-btn", os.t("oc.again"));
        next.type = again.type = "button";
        next.addEventListener("click", function(){ start(pick(s.id)); });
        again.addEventListener("click", function(){ start(s); });
        end.appendChild(next);
        end.appendChild(again);
        pm.appendChild(end);
      }

      /* ---------- the game ---------- */
      // A 20 x 12 tile flat at night: bedroom on the left, study on the right, a doorway between. The furniture
      // comes from Kenney's Roguelike Indoors sheet (16 px tiles, 1 px apart), the player from the RPG Urban
      // sheet (16 px, packed); the bed, rug, laptop, phone, rack and Kuai Kuai are drawn here because the packs
      // have none that fit. Walking costs no game time; only actions move the clock.
      function loadImgs(){
        return Promise.all([["in", "apps/oncall/indoor.png"], ["ur", "apps/oncall/urban.png"]].map(function(x){
          return IMG[x[0]] ? null : new Promise(function(ok, no){
            var im = new Image();
            im.onload = function(){ IMG[x[0]] = im; ok(); };
            im.onerror = no;
            im.src = x[1];
          });
        }));
      }

      function startRpg(){
        rpg = {p:{x:START[0], y:START[1], tx:START[0], ty:START[1], dir:"right", t:0, moving:false, walk:0, path:[], then:null},
               held:[], answered:false, pcOn:false, panelAt:null, outs:{pc:[], phone:[], rack:[]}, queue:[], typing:null,
               raf:0, last:0, ending:0, endShown:false};
        drawBar();
        goalEl.textContent = "";
        [sayEl, panel, book, endEl].forEach(function(x){ x.hidden = true; });
        loadEl.hidden = false;
        loadImgs().then(function(){
          if (!rpg) return;
          loadEl.hidden = true;
          if (!stat) buildStatic();
          talk(os.fill(os.t("rpg.wake"), {t:g.s.clock}));
          drawGoal();
          rpg.raf = requestAnimationFrame(frame);
          cv.focus();
        }, function(){ loadEl.textContent = os.t("rpg.loadFail"); });
      }

      function stopRpg(){
        if (!rpg) return;
        cancelAnimationFrame(rpg.raf);
        clearInterval(rpg.typing);
        rpg = null;
      }

      function blocked(x, y){
        if (x < 0 || y < 0 || x >= MW || y >= MH || MAP[y].charAt(x) === "#") return true;
        return PROPS.some(function(p){ return p.block && p.x === x && (p.y === y || (p.h === 2 && p.y + 1 === y)); });
      }
      function thingAt(x, y){
        return THINGS.filter(function(t){ return t.tiles.some(function(c){ return c[0] === x && c[1] === y; }); })[0];
      }
      // Breadth-first search over the tile grid; returns the tiles to walk, excluding where you stand.
      function route(fx, fy, tx, ty){
        if (blocked(tx, ty)) return null;
        var prev = {}, seen = {}, qq = [[fx, fy]];
        seen[fx + "," + fy] = 1;
        while (qq.length) {
          var c = qq.shift();
          if (c[0] === tx && c[1] === ty) {
            var out = [], k = tx + "," + ty;
            while (k !== fx + "," + fy) { out.unshift(k.split(",").map(Number)); k = prev[k]; }
            return out;
          }
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(d){
            var nx = c[0] + d[0], ny = c[1] + d[1], nk = nx + "," + ny;
            if (!seen[nk] && !blocked(nx, ny)) { seen[nk] = 1; prev[nk] = c[0] + "," + c[1]; qq.push([nx, ny]); }
          });
        }
        return null;
      }

      function busy(){ return !sayEl.hidden || !panel.hidden || !book.hidden || !!rpg.ending; }
      function walkTo(x, y, then){
        var p = rpg.p, r = route(p.tx, p.ty, x, y);
        if (!r) return false;
        p.path = r;
        p.then = then || null;
        if (os.still.matches && r.length) {   // reduced motion: arrive at once
          var last = r[r.length - 1];
          p.dir = dirTo(r.length > 1 ? r[r.length - 2] : [p.tx, p.ty], last);
          p.x = p.tx = last[0]; p.y = p.ty = last[1]; p.path = []; p.moving = false;
          arrive();
        } else if (!r.length && !p.moving) arrive();
        return true;
      }
      function dirTo(a, b){ return b[0] > a[0] ? "right" : b[0] < a[0] ? "left" : b[1] > a[1] ? "down" : "up"; }
      function stepTo(x, y){
        var p = rpg.p;
        p.dir = dirTo([p.x, p.y], [x, y]);
        p.tx = x; p.ty = y; p.moving = true; p.t = 0;
      }
      function arrive(){
        var p = rpg.p;
        if (p.path.length || !p.then) return;
        var f = p.then;
        p.then = null;
        f();
      }

      // Click a thing: walk to its nearest standing spot, face it, use it. Click the floor: walk there.
      function useThing(t){
        var p = rpg.p, best = null;
        t.spots.forEach(function(s){
          var r = s[0] === p.tx && s[1] === p.ty ? [] : route(p.tx, p.ty, s[0], s[1]);
          if (r && (!best || r.length < best.r.length)) best = {s:s, r:r};
        });
        if (!best) return;
        walkTo(best.s[0], best.s[1], function(){ rpg.p.dir = best.s[2]; interact(t.id); });
      }
      function facing(){
        var p = rpg.p, d = DIRS[p.dir];
        return thingAt(p.x + d[0], p.y + d[1]);
      }

      function talk(text){
        rpg.queue.push(text);
        if (sayEl.hidden) nextTalk();
      }
      function nextTalk(){
        var text = rpg.queue.shift();
        clearInterval(rpg.typing);
        rpg.typing = null;
        if (text == null) { sayEl.hidden = true; cv.focus(); return; }
        sayEl.hidden = false;
        var p = sayEl.querySelector("p"), i = 0;
        sayEl._full = text;
        if (os.still.matches) { p.textContent = text; return; }
        p.textContent = "";
        rpg.typing = setInterval(function(){
          i += 2;
          p.textContent = text.slice(0, i);
          if (i >= text.length) { clearInterval(rpg.typing); rpg.typing = null; }
        }, 24);
      }
      // First press finishes the line being typed; the next one moves on.
      function advance(){
        if (rpg.typing) { clearInterval(rpg.typing); rpg.typing = null; sayEl.querySelector("p").textContent = sayEl._full; return; }
        nextTalk();
      }

      function stationsNow(){
        var st = g.s.steps[g.step], at = [];
        st.opts.forEach(function(o, i){
          var a = o.at || "pc";
          if (!g.used[g.step + ":" + i] && at.indexOf(a) < 0) at.push(a);
        });
        return at;
      }
      function drawGoal(){
        if (!rpg) return;
        if (!rpg.answered) goalEl.textContent = os.t("rpg.goalPhone");
        else if (g.done) goalEl.textContent = os.t("rpg.goalBed");
        else goalEl.textContent = os.fill(os.t("rpg.goal"), {ask:L(g.s.steps[g.step].ask), where:where()});
      }

      function interact(id){
        if (g.done) { if (id === "bed") endGame(); else talk(os.t("rpg.goBed")); return; }
        if (!rpg.answered) {
          if (id !== "phone") { talk(os.t("rpg.phoneFirst")); return; }
          rpg.answered = true;
          talk(os.fill(os.t("rpg.answer"), {n:g.s.alerts.length}));
          g.s.alerts.forEach(function(a){ talk(a.sev + "　" + L(a.text)); });
          drawGoal();
          if (!book.hidden) drawLog(bookList);
          return;
        }
        if (id === "bed") { talk(os.t("rpg.bedEarly")); return; }
        if (id === "shelf") { talk(os.t("rpg.shelf")); return; }
        if (id === "rack" && stationsNow().indexOf("rack") < 0 && !rpg.outs.rack.length) { talk(os.t("rpg.rack")); return; }
        if (id === "pc") rpg.pcOn = true;
        rpg.panelAt = id;
        drawPanel();
      }

      // A station's screen keeps everything done there, then asks the current question.
      function drawPanel(){
        var id = rpg.panelAt, st = g.s.steps[g.step];
        panel.className = "oc-panel " + id;
        panel.querySelector("b").textContent = os.t("rpg.at." + id);
        var po = panel.querySelector(".oc-po"), pa = panel.querySelector(".oc-pa");
        po.textContent = "";
        rpg.outs[id].forEach(function(o){
          po.appendChild(make("div", "cmd", (id === "pc" ? "$ " : "> ") + L(o.label) + "  " + os.fill(os.t("oc.cost"), {m:o.min})));
          var res = make("div", o.trap ? "bad" : "", L(o.say));
          if (o.trap) res.setAttribute("data-tag", os.t("oc.trap"));
          po.appendChild(res);
        });
        if (!g.done) po.appendChild(make("div", "q", L(st.ask)));
        pa.textContent = "";
        if (!g.done) {
          var any = false;
          g.order[g.step].forEach(function(i){
            var o = st.opts[i];
            if ((o.at || "pc") !== id || g.used[g.step + ":" + i]) return;
            any = true;
            var b = make("button", "", (id === "pc" ? "$ " : "") + L(o.label));   // the laptop reads like a shell
            b.type = "button";
            b.addEventListener("click", function(){ choose(o, i); });
            pa.appendChild(b);
          });
          if (!any) pa.appendChild(make("p", "none", os.fill(os.t("rpg.nothing"), {where:where()})));
        }
        pa.hidden = g.done;
        panel.hidden = false;
        po.scrollTop = po.scrollHeight;
        var first = pa.querySelector("button");
        if (first) first.focus(); else panel.querySelector(".oc-x").focus();
      }
      function closePanel(){
        panel.hidden = true;
        rpg.panelAt = null;
        cv.focus();
      }

      function openBook(){
        if (!rpg || rpg.ending) return;
        drawLog(bookList);
        book.hidden = false;
        bookList.scrollTop = bookList.scrollHeight;
        book.querySelector(".oc-x").focus();
      }
      function closeBook(){
        book.hidden = true;
        cv.focus();
      }

      function rpgAfter(o){
        rpg.outs[o.at || "pc"].push(o);
        drawBar();
        drawPanel();
        drawGoal();
        if (g.done) setTimeout(function(){ if (!rpg) return; closePanel(); talk(os.t("rpg.fixed")); }, os.still.matches ? 0 : 1100);
      }

      // Into bed: lights out, a few z's, then morning through the window and the ending card.
      var NIGHT = 1600, DAWN = 1400;
      function endGame(){
        var r = result();
        g.grade = r.grade;
        var best = loadBest();
        if (!best[g.s.id] || GRADE_ORDER.indexOf(r.grade) < GRADE_ORDER.indexOf(best[g.s.id])) { best[g.s.id] = r.grade; saveBest(best); }
        rpg.ending = performance.now();
        rpg.p.x = rpg.p.tx = 1; rpg.p.y = rpg.p.ty = 2; rpg.p.moving = false; rpg.p.dir = "down";
        goalEl.textContent = "";
        if (os.still.matches) rpg.ending -= NIGHT + DAWN;
      }
      function showEnd(){
        var r = result(), card = endEl.querySelector(".oc-endcard");
        card.textContent = "";
        card.appendChild(make("div", "end", "END"));
        card.appendChild(make("div", "gr " + r.grade, r.grade));
        card.appendChild(make("h2", "", os.fill(os.t("end.title"), {g:r.grade, name:os.t("end." + r.grade)})));
        card.appendChild(make("p", "", os.fill(os.t("end." + r.grade + ".t"), {m:g.mins})));
        card.appendChild(make("p", "was", os.fill(os.t("end.was"), {name:L(g.s.name)})));
        card.appendChild(make("p", "st", os.fill(os.t("end.stats"), {m:g.mins, n:r.traps, meter:L(g.s.meter), v:num(g.meter)})));
        var row = make("div", "row"), toPm = make("button", "oc-btn pri", os.t("end.pm")), next = make("button", "oc-btn", os.t("oc.next"));
        toPm.type = next.type = "button";
        toPm.addEventListener("click", function(){
          stopRpg();
          drawPm();
          rpgEl.hidden = true; barEl.hidden = true; pm.hidden = false;
          el.scrollTop = 0;
        });
        next.addEventListener("click", function(){ start(pick(g.s.id)); });
        row.appendChild(toPm);
        row.appendChild(next);
        card.appendChild(row);
        endEl.hidden = false;
        toPm.focus();
      }

      /* ----- drawing ----- */
      function tileIn(c, r, x, y){ stx.drawImage(IMG["in"], c * 17, r * 17, 16, 16, x, y, 16, 16); }
      function buildStatic(){
        stat = document.createElement("canvas");
        stat.width = MW * T; stat.height = MH * T;
        stx = stat.getContext("2d");
        stx.imageSmoothingEnabled = false;
        for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
          if (MAP[y].charAt(x) === "#") drawWall(stx, x, y); else drawFloor(stx, x, y);
        }
        drawRug(stx, 3, 5, 3, 2);
        PROPS.forEach(function(p){
          if (p.c != null) tileIn(p.c, p.r, p.x * T, p.y * T + (p.dy || 0));
          else if (ART[p.art]) stx.drawImage(sprite(p.art), p.x * T, p.y * T + (p.dy || 0));
        });
      }
      function drawFloor(s, x, y){
        var X = x * T, Y = y * T;
        s.fillStyle = "#B88A5C"; s.fillRect(X, Y, T, T);
        s.fillStyle = "#A67A4F";
        for (var i = 0; i < 4; i++) s.fillRect(X, Y + i * 4 + 3, T, 1);
        s.fillRect(X + ((x * 7 + y * 5) % 12) + 2, Y, 1, 3);
        s.fillRect(X + ((x * 3 + y * 11) % 12) + 2, Y + 8, 1, 3);
      }
      // The pack has no rugs (its bordered pieces are tables), so this one is drawn: a blue-grey rug with a border.
      function drawRug(s, x, y, w, h){
        var X = x * T + 2, Y = y * T + 3, W = w * T - 4, H = h * T - 6;
        s.fillStyle = "#3D4C69"; s.fillRect(X, Y, W, H);
        s.fillStyle = "#6B7EA4"; s.fillRect(X + 2, Y + 2, W - 4, 1); s.fillRect(X + 2, Y + H - 3, W - 4, 1);
        s.fillRect(X + 2, Y + 2, 1, H - 4); s.fillRect(X + W - 3, Y + 2, 1, H - 4);
        s.fillStyle = "#56678C";
        for (var i = X + 6; i < X + W - 6; i += 4) s.fillRect(i, Y + Math.floor(H / 2), 2, 1);
        s.fillStyle = "#C9C1AE";
        for (var j = X + 1; j < X + W - 1; j += 2) { s.fillRect(j, Y - 1, 1, 1); s.fillRect(j, Y + H, 1, 1); }
      }
      function drawWall(s, x, y){
        var X = x * T, Y = y * T, face = y === 1 && MAP[2].charAt(x) !== "#";
        if (face) {   // the wall face you see above the floor
          s.fillStyle = "#E8DBBE"; s.fillRect(X, Y, T, T);
          s.fillStyle = "#D6C6A2"; s.fillRect(X, Y + 12, T, 1);
          s.fillStyle = "#8A6A48"; s.fillRect(X, Y + 13, T, 3);
        } else {
          s.fillStyle = "#CDB98F"; s.fillRect(X, Y, T, T);
          s.fillStyle = "#7A5C3E";
          if (y === MH - 1 || (y > 1 && MAP[y - 1].charAt(x) !== "#")) s.fillRect(X, Y, T, 1);
          if (x > 0 && MAP[y].charAt(x - 1) !== "#") s.fillRect(X, Y, 1, T);
          if (x < MW - 1 && MAP[y].charAt(x + 1) !== "#") s.fillRect(X + T - 1, Y, 1, T);
        }
      }

      function frame(ts){
        if (!rpg) return;
        var dt = Math.min(50, ts - (rpg.last || ts));
        rpg.last = ts;
        update(dt);
        if (!rpg) return;
        draw(ts);
        if (rpg.ending && !rpg.endShown && ts - rpg.ending >= NIGHT + DAWN) { rpg.endShown = true; showEnd(); }
        rpg.raf = requestAnimationFrame(frame);
      }
      function update(dt){
        var p = rpg.p;
        if (p.moving) {
          p.t += dt / 150;
          if (p.t >= 1) {
            p.x = p.tx; p.y = p.ty; p.moving = false; p.t = 0; p.walk++;
            if (!p.path.length) arrive();
            if (!rpg) return;
          }
        }
        if (!p.moving && !busy()) {
          if (p.path.length) { var n = p.path.shift(); stepTo(n[0], n[1]); }
          else if (rpg.held.length) {
            var d = rpg.held[rpg.held.length - 1], v = DIRS[d];
            p.dir = d;
            if (!blocked(p.x + v[0], p.y + v[1])) stepTo(p.x + v[0], p.y + v[1]);
          }
        }
      }

      function draw(ts){
        var p = rpg.p, ringing = !rpg.answered, pulse = (Math.sin(ts / 180) + 1) / 2;
        var e = rpg.ending ? ts - rpg.ending : -1, night = e < 0 ? 0 : Math.min(1, e / NIGHT), dawn = e < NIGHT ? 0 : Math.min(1, (e - NIGHT) / DAWN);
        cx.imageSmoothingEnabled = false;
        cx.drawImage(stat, 0, 0);
        // Live props: the phone shakes while ringing, the laptop screen lights once opened, the rack blinks.
        var shake = ringing && !os.still.matches && Math.floor(ts / 90) % 2 ? 1 : 0;
        cx.drawImage(sprite("phone", ringing ? {S:pulse > .5 ? "#FF5A5A" : "#FFE3E3"} : null), PHONE[0] * T + shake, PHONE[1] * T - 5);
        cx.drawImage(sprite("laptop", rpg.pcOn && !rpg.ending ? {s:"#DDF1FF"} : null), PC[0] * T + 8, PC[1] * T - 7);
        cx.drawImage(sprite("rack", Math.floor(ts / 400) % 2 ? {r:"#4A1F1F", G:"#1F4A2A"} : null), RACK[0] * T, RACK[1] * T - 2);
        cx.drawImage(sprite("kuai"), RACK[0] * T, RACK[1] * T - 11);

        var fx = (p.x + (p.tx - p.x) * p.t) * T, fy = (p.y + (p.ty - p.y) * p.t) * T;
        if (rpg.ending) {
          // Tucked in: the head on the pillow, the blanket drawn back over the body.
          cx.drawImage(IMG.ur, 24 * 16, CHAR * 16, 16, 9, 1 * T, 2 * T + 1, 16, 9);
          cx.drawImage(sprite("bed"), 0, 7, 16, 18, 1 * T, 2 * T + 6, 16, 18);
        } else {
          var col = {left:23, down:24, up:25, right:26}[p.dir], row = p.moving ? 1 + (p.walk % 2) : 0;
          cx.drawImage(IMG.ur, col * 16, (CHAR + row) * 16, 16, 16, Math.round(fx), Math.round(fy) - 4, 16, 16);
        }

        // Night: darken everything, then cut out light around the player, the screens and the window.
        // Going to sleep pushes the dark to black; dawn lifts it and brings sun through the window.
        var dark = darkLayer(), d = dark.getContext("2d");
        d.globalCompositeOperation = "source-over";
        d.clearRect(0, 0, dark.width, dark.height);
        d.fillStyle = "rgba(8,10,32," + (.66 + night * .32 - dawn * .9) + ")";
        d.fillRect(0, 0, dark.width, dark.height);
        d.globalCompositeOperation = "destination-out";
        if (!rpg.ending) light(d, fx + 8, fy + 4, 30, .85);
        light(d, WIN[0] * T + 16, WIN[1] * T + 14, 34 + dawn * 40, .55 * (1 - night) + dawn * .6);
        if (!rpg.ending) {
          light(d, PHONE[0] * T + 8, PHONE[1] * T + 4, ringing ? 18 + pulse * 8 : 10, .9);
          if (rpg.pcOn) light(d, PC[0] * T + 16, PC[1] * T + 6, 56, .95);
          light(d, RACK[0] * T + 8, RACK[1] * T + 10, 12, .6);
        }
        cx.drawImage(dark, 0, 0);
        if (ringing) glow(PHONE[0] * T + 8, PHONE[1] * T + 4, 22, "rgba(255,70,70," + (.18 + pulse * .25) + ")");
        if (rpg.pcOn && !rpg.ending) glow(PC[0] * T + 16, PC[1] * T + 2, 26, "rgba(150,200,255,.18)");
        if (dawn) glow(WIN[0] * T + 16, WIN[1] * T + 30, 70 * dawn + 10, "rgba(255,200,120," + (.35 * dawn) + ")");
        if (night && !dawn && !os.still.matches) zees(e);

        // A bouncing marker over whatever you can use from here.
        var t = !busy() && !p.moving && facing();
        if (t) {
          var top = t.tiles.reduce(function(a, c){ return c[1] < a[1] ? c : a; });
          var bx = top[0] * T + 8, by = top[1] * T - 9 + (os.still.matches ? 0 : Math.round(Math.sin(ts / 150) * 1.5));
          cx.fillStyle = "#FFFFFF";
          cx.fillRect(bx - 3, by, 7, 1); cx.fillRect(bx - 2, by + 1, 5, 1); cx.fillRect(bx - 1, by + 2, 3, 1); cx.fillRect(bx, by + 3, 1, 1);
        }
      }
      // Three z's drifting up from the pillow while the lights go out.
      function zees(e){
        cx.fillStyle = "#F5EEDC";
        for (var i = 0; i < 3; i++) {
          var k = ((e / 900) + i / 3) % 1, x = 1 * T + 12 + k * 14, y = 2 * T - k * 18, s = i === 1 ? 2 : 1;
          cx.globalAlpha = 1 - k;
          cx.fillRect(x, y, 3 * s, s); cx.fillRect(x + s, y + s, s, s); cx.fillRect(x, y + 2 * s, 3 * s, s);
        }
        cx.globalAlpha = 1;
      }
      function darkLayer(){
        if (!darkC) { darkC = document.createElement("canvas"); darkC.width = MW * T; darkC.height = MH * T; }
        return darkC;
      }
      function light(d, x, y, r, a){
        var gr = d.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(0,0,0," + Math.max(0, Math.min(1, a)) + ")");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        d.fillStyle = gr;
        d.fillRect(x - r, y - r, r * 2, r * 2);
      }
      function glow(x, y, r, color){
        var gr = cx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        cx.globalCompositeOperation = "lighter";
        cx.fillStyle = gr;
        cx.fillRect(x - r, y - r, r * 2, r * 2);
        cx.globalCompositeOperation = "source-over";
      }

      /* ----- input ----- */
      var KEYS = {ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right", w:"up", s:"down", a:"left", d:"right", W:"up", S:"down", A:"left", D:"right"};
      cv.addEventListener("keydown", function(e){
        if (!rpg) return;
        if (e.key === "j" || e.key === "J") { e.preventDefault(); if (!busy()) openBook(); return; }
        var d = KEYS[e.key];
        if (d) {
          e.preventDefault();
          if (busy()) return;
          var p = rpg.p;
          p.path = []; p.then = null;
          if (rpg.held.indexOf(d) < 0) rpg.held.push(d);
          // Step right away, so a quick tap that is released before the next frame still moves (or turns you).
          if (!p.moving && !e.repeat) {
            var v = DIRS[d];
            p.dir = d;
            if (!blocked(p.x + v[0], p.y + v[1])) stepTo(p.x + v[0], p.y + v[1]);
          }
          return;
        }
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (!sayEl.hidden) { advance(); return; }
          var t = !busy() && facing();
          if (t && !rpg.p.moving) interact(t.id);
        }
      });
      cv.addEventListener("keyup", function(e){
        if (!rpg) return;
        var d = KEYS[e.key];
        if (d) rpg.held = rpg.held.filter(function(x){ return x !== d; });
      });
      cv.addEventListener("blur", function(){ if (rpg) rpg.held = []; });
      cv.addEventListener("pointerdown", function(e){
        if (!rpg || !stat || rpg.ending) return;
        cv.focus();
        if (!sayEl.hidden) { advance(); return; }
        var rc = cv.getBoundingClientRect();
        var x = Math.floor((e.clientX - rc.left) / rc.width * MW), y = Math.floor((e.clientY - rc.top) / rc.height * MH);
        var t = thingAt(x, y);
        if (t) useThing(t); else walkTo(x, y);
      });
      sayEl.addEventListener("click", function(){ if (rpg) advance(); });
      panel.addEventListener("keydown", function(e){ if (e.key === "Escape") { e.stopPropagation(); closePanel(); } });
      book.addEventListener("keydown", function(e){ if (e.key === "Escape" || e.key === "j" || e.key === "J") { e.stopPropagation(); closeBook(); } });
      panel.querySelector(".oc-x").addEventListener("click", closePanel);
      book.querySelector(".oc-x").addEventListener("click", closeBook);
      el.querySelector(".oc-logb").addEventListener("click", function(){ if (rpg && book.hidden) openBook(); else if (rpg) closeBook(); });
      el.querySelector(".oc-re").addEventListener("click", function(){ start(pick(g && g.s.id)); });

      var off = os.onLang(function(){
        if (!g) return;
        if (!pm.hidden) { drawPm(); return; }
        if (!rpg) return;
        drawBar();
        drawGoal();
        if (!panel.hidden) drawPanel();
        if (!book.hidden) drawLog(bookList);
        if (!endEl.hidden) showEnd();
      });
      start(pick());
      return function(){ off(); stopRpg(); };
    }
  });

  var stat = null, stx = null, darkC = null;   // the floor, walls and furniture are drawn once and shared
  var SPR = {};
  function sprite(name, alt){
    var key = name + (alt ? JSON.stringify(alt) : "");
    if (SPR[key]) return SPR[key];
    var art = ART[name], c = document.createElement("canvas");
    c.width = art[0].length; c.height = art.length;
    var s = c.getContext("2d");
    art.forEach(function(row, y){
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);
        if (ch === ".") continue;
        s.fillStyle = (alt && alt[ch]) || PAL[ch];
        s.fillRect(x, y, 1, 1);
      }
    });
    return (SPR[key] = c);
  }
})();
