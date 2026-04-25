/**
 * FOTOSNAPS BACKEND - V16 (Aligned with actual DB columns)
 * 1. Run 'setup' function manually first to authorize scopes.
 * 2. Deploy as Web App -> Execute as: "Me", Access: "Anyone".
 * COLUMN ORDER: id[0] | name[1] | email[2] | phone[3] | address[4] | birthDate[5] | currentStamps[6] | maxStamps[7] | createdAt[8]
 */

function setup() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSheet(doc, 'Users', [
      'id', 'name', 'email', 'phone', 'address', 'birthDate', 'currentStamps', 'maxStamps', 'createdAt'
  ]);
  getOrCreateSheet(doc, 'Transactions', [
      'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
  ]);
  getOrCreateSheet(doc, 'CheckpointConfig', [
      'maxStamps', 'checkpoints'
  ]);
  // NEW: Initialize Vouchers sheet
  getOrCreateSheet(doc, 'Vouchers', [
      'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
  ]);
  // NEW: Initialize AdminList sheet
  getOrCreateSheet(doc, 'AdminList', [
      'id', 'name', 'code'
  ]);
  Logger.log("Setup Complete. You can now Deploy.");
}

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonResponse({ success: false, error: "Server busy, please try again." });
  }
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    let requestData = e.parameter || {};
    if (e.postData && e.postData.contents) {
      try {
        const jsonBody = JSON.parse(e.postData.contents);
        requestData = { ...requestData, ...jsonBody };
      } catch (err) {}
    }

    const action = requestData.action;
    const usersSheet = getOrCreateSheet(doc, 'Users', [
      'id', 'name', 'email', 'phone', 'address', 'birthDate', 'currentStamps', 'maxStamps', 'createdAt'
    ]);
    
    const txSheet = getOrCreateSheet(doc, 'Transactions', [
      'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
    ]);

    let result = { success: false };

    if (action === 'register') {
      const allUsers = usersSheet.getDataRange().getValues();
      const inputPhone = String(requestData.phone || '').trim().replace(/\s/g, '');
      
      const exists = allUsers.slice(1).some(row => String(row[3]).trim().replace(/\s/g, '') === inputPhone);
      
      if (exists) {
        result = { success: false, error: "Phone number already registered." };
      } else {
        const newUser = [
          requestData.id || 'user-' + new Date().getTime(),
          requestData.name,
          requestData.email,
          String(requestData.phone || '').trim(),
          requestData.address || '',
          String(requestData.birthDate || '').trim(), // birthDate [5]
          0,   // currentStamps [6]
          10,  // maxStamps [7]
          new Date().toISOString() // createdAt [8]
        ];
        usersSheet.appendRow(newUser);
        SpreadsheetApp.flush();
        result = { success: true, user: mapRowToUser(newUser, []) };
      }
    }

    else if (action === 'login') {
      const allUsers = usersSheet.getDataRange().getValues();
      const inputPhone = String(requestData.username || '').trim().replace(/\s/g, '');
      const inputBirth = String(requestData.password || '').trim();

      if (allUsers.length <= 1) {
         result = { success: false, error: "Database is empty." };
      } else {
         const row = allUsers.slice(1).find(r => {
           const sheetPhone = String(r[3]).trim().replace(/\s/g, '');
           const sheetDate = formatDate(r[5]); // birthDate = col index 5
           return sheetPhone === inputPhone && sheetDate === inputBirth;
         });

         if (row) {
           result = { success: true, user: mapRowToUser(row, []) };
         } else {
           result = { success: false, error: "Invalid phone number or birth date." };
         }
      }
    }

    else if (action === 'getUser') {
      const userId = String(requestData.id).trim();
      const allUsers = usersSheet.getDataRange().getValues();
      const row = allUsers.slice(1).find(r => String(r[0]) === userId);
      
      if (row) {
        result = { success: true, user: mapRowToUser(row, []) };
      } else {
        result = { success: false, error: "User not found." };
      }
    }

    else if (action === 'getHistory') {
      const userId = String(requestData.userId).trim();
      const history = getTransactionsForUser(txSheet, doc, userId);
      result = { success: true, history: history };
    }

    else if (action === 'addStamp') {
      const userId = requestData.userId;
      const allUsers = usersSheet.getDataRange().getValues();
      const userIndex = allUsers.slice(1).findIndex(r => String(r[0]) === String(userId));

      if (userIndex === -1) {
        result = { success: false, error: "User not found." };
      } else {
        const realRow = userIndex + 2;
        const currentStamps = parseInt(allUsers[userIndex + 1][6] || 0); // currentStamps = col 6
        const maxStamps = parseInt(allUsers[userIndex + 1][7] || 10);    // maxStamps = col 7
        
        if (currentStamps < maxStamps) {
          const newStampCount = currentStamps + 1;
          usersSheet.getRange(realRow, 7).setValue(newStampCount); // currentStamps is col 7 (1-indexed)
          const now = new Date();
          txSheet.appendRow(['tx-' + now.getTime(), userId, 'add', 1, now.getTime(), now.toISOString()]);
          SpreadsheetApp.flush();
          
          // Check if this stamp count is a checkpoint
          const checkpointConfig = getCheckpointConfiguration(doc);
          const checkpoint = checkIfCheckpoint(newStampCount, checkpointConfig);
          let newVoucher = null;
          
          if (checkpoint) {
            // Generate voucher for this checkpoint
            newVoucher = generateVoucher(doc, userId, newStampCount, checkpoint.reward);
          }
          
          const history = getTransactionsForUser(txSheet, doc, userId);
          const updatedRow = [...allUsers[userIndex + 1]];
          updatedRow[6] = newStampCount; // currentStamps index
          result = { 
            success: true, 
            user: mapRowToUser(updatedRow, history),
            voucher: newVoucher // Include voucher if checkpoint reached
          };
        } else {
          result = { success: false, error: "Max stamps reached." };
        }
      }
    }
    
    else if (action === 'getAll') {
       const allUsers = usersSheet.getDataRange().getValues().slice(1);
       result = { users: allUsers.map(r => mapRowToUser(r, [])) };
    }

    // Get checkpoint configuration — reads purely from CheckpointConfig sheet
    else if (action === 'getCheckpointConfig') {
      const configSheet = getOrCreateSheet(doc, 'CheckpointConfig', ['maxStamps', 'checkpoints']);
      const data = configSheet.getDataRange().getValues();
      
      if (data.length < 2) {
        // Sheet exists but has no data row — return empty config
        result = {
          success: true,
          config: {
            maxStamps: 10,
            checkpoints: []
          }
        };
      } else {
        const maxStamps = parseInt(data[1][0]) || 10;
        let checkpoints = [];
        try {
          checkpoints = JSON.parse(data[1][1] || '[]');
        } catch (e) {
          checkpoints = [];
        }
        
        result = {
          success: true,
          config: {
            maxStamps: maxStamps,
            checkpoints: checkpoints
          }
        };
      }
    }

    // NEW: Save checkpoint configuration
    else if (action === 'saveCheckpointConfig') {
      const configSheet = getOrCreateSheet(doc, 'CheckpointConfig', ['maxStamps', 'checkpoints']);
      const maxStamps = parseInt(requestData.maxStamps) || 10;
      const checkpoints = requestData.checkpoints || [];
      
      // Clear existing data (except header)
      if (configSheet.getLastRow() > 1) {
        configSheet.deleteRows(2, configSheet.getLastRow() - 1);
      }
      
      // Add new configuration
      configSheet.appendRow([
        maxStamps,
        JSON.stringify(checkpoints)
      ]);
      SpreadsheetApp.flush();
      
      result = {
        success: true,
        config: {
          maxStamps: maxStamps,
          checkpoints: checkpoints
        }
      };
    }

    // NEW: Get user vouchers
    else if (action === 'getUserVouchers') {
      const userId = String(requestData.userId).trim();
      const vouchersSheet = getOrCreateSheet(doc, 'Vouchers', [
        'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
      ]);
      
      const allVouchers = vouchersSheet.getDataRange().getValues().slice(1);
      const userVouchers = allVouchers
        .filter(row => String(row[1]) === userId)
        .map(row => {
          const now = new Date();
          const expiresAt = new Date(row[5]);
          let status = row[7];
          
          // Auto-update expired vouchers
          if (status === 'active' && expiresAt < now) {
            status = 'expired';
          }
          
          return {
            id: row[0],
            userId: row[1],
            checkpointStampCount: parseInt(row[2]),
            rewardName: row[3],
            createdAt: row[4],
            expiresAt: row[5],
            redeemedAt: row[6] || null,
            status: status
          };
        });
      
      result = { success: true, vouchers: userVouchers };
    }

    // NEW: Redeem voucher
    else if (action === 'redeemVoucher') {
      const voucherId = String(requestData.voucherId).trim();
      const userId = String(requestData.userId).trim();
      
      const vouchersSheet = getOrCreateSheet(doc, 'Vouchers', [
        'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
      ]);
      
      const allVouchers = vouchersSheet.getDataRange().getValues();
      const voucherIndex = allVouchers.slice(1).findIndex(r => String(r[0]) === voucherId);
      
      if (voucherIndex === -1) {
        result = { success: false, error: "Voucher not found." };
      } else {
        const voucherRow = allVouchers[voucherIndex + 1];
        const voucherUserId = String(voucherRow[1]);
        const expiresAt = new Date(voucherRow[5]);
        const currentStatus = voucherRow[7];
        const now = new Date();
        
        // Validate ownership
        if (voucherUserId !== userId) {
          result = { success: false, error: "This voucher does not belong to you." };
        }
        // Check if already redeemed
        else if (currentStatus === 'redeemed') {
          result = { success: false, error: "This voucher has already been redeemed." };
        }
        // Check if expired
        else if (expiresAt < now || currentStatus === 'expired') {
          result = { success: false, error: "This voucher has expired." };
        }
        else {
          // Redeem the voucher
          const realRow = voucherIndex + 2;
          vouchersSheet.getRange(realRow, 7).setValue(now.toISOString()); // redeemedAt
          vouchersSheet.getRange(realRow, 8).setValue('redeemed'); // status
          
          // Log transaction
          txSheet.appendRow([
            'tx-' + now.getTime(),
            userId,
            'voucher_redeemed',
            1,
            now.getTime(),
            now.toISOString()
          ]);
          
          SpreadsheetApp.flush();
          
          result = {
            success: true,
            voucher: {
              id: voucherRow[0],
              userId: voucherRow[1],
              checkpointStampCount: parseInt(voucherRow[2]),
              rewardName: voucherRow[3],
              createdAt: voucherRow[4],
              expiresAt: voucherRow[5],
              redeemedAt: now.toISOString(),
              status: 'redeemed'
            }
          };
        }
      }
    }

    // Dashboard analytics
    else if (action === 'getDashboardData') {
      const allUsers = usersSheet.getDataRange().getValues().slice(1);
      const allTx = txSheet.getDataRange().getValues().slice(1);

      const now = new Date();
      const msPerDay = 24 * 60 * 60 * 1000;
      const msPerWeek = 7 * msPerDay;
      const oneMonthAgo = new Date(now.getTime() - 30 * msPerDay);

      // --- Total members ---
      const totalMembers = allUsers.length;

      // --- New members per week (last 8 weeks) ---
      const weeklyGrowth = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * msPerWeek);
        const weekStart = new Date(weekEnd.getTime() - msPerWeek);
        const count = allUsers.filter(function(row) {
          const createdAt = new Date(row[8]); // createdAt = col 8
          return createdAt >= weekStart && createdAt < weekEnd;
        }).length;

        // Label: "Mar 10"
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const label = months[weekStart.getMonth()] + ' ' + weekStart.getDate();
        weeklyGrowth.push({ label: label, count: count });
      }

      // --- Last stamp activity per user ---
      const lastStampPerUser = {};
      allTx.filter(function(r) { return r[2] === 'add'; }).forEach(function(r) {
        const userId = String(r[1]);
        const ts = Number(r[4]);
        if (!lastStampPerUser[userId] || ts > lastStampPerUser[userId]) {
          lastStampPerUser[userId] = ts;
        }
      });

      // --- At-risk customers: no stamp activity in last 30 days ---
      const atRiskUsers = allUsers
        .filter(function(row) {
          const userId = String(row[0]);
          const lastStamp = lastStampPerUser[userId];
          if (!lastStamp) return true; // never received a stamp
          return new Date(lastStamp) < oneMonthAgo;
        })
        .map(function(row) {
          const userId = String(row[0]);
          const lastTs = lastStampPerUser[userId] || null;
          return {
            id: userId,
            name: row[1],
            phone: row[3],
            stamps: parseInt(row[6] || 0), // currentStamps = col 6
            lastStampAt: lastTs ? new Date(lastTs).toISOString() : null,
            daysSinceLastStamp: lastTs ? Math.floor((now.getTime() - lastTs) / msPerDay) : null
          };
        })
        .sort(function(a, b) {
          // Sort: never-stamped first, then longest inactive
          if (!a.lastStampAt && !b.lastStampAt) return 0;
          if (!a.lastStampAt) return -1;
          if (!b.lastStampAt) return 1;
          return (b.daysSinceLastStamp || 0) - (a.daysSinceLastStamp || 0);
        });

      // --- Active members breakdown: new (<1 month join) vs veteran (>1 month join) ---
      const activeUsers = allUsers.filter(function(row) {
        const userId = String(row[0]);
        const lastStamp = lastStampPerUser[userId];
        if (!lastStamp) return false;
        return new Date(lastStamp) >= oneMonthAgo;
      });
      const newActiveCount = activeUsers.filter(function(row) {
        return new Date(row[8]) >= oneMonthAgo; // createdAt = col 8
      }).length;
      const veteranActiveCount = activeUsers.filter(function(row) {
        return new Date(row[8]) < oneMonthAgo; // createdAt = col 8
      }).length;

      // --- Daily member registrations for last 56 days (8 weeks x 7 days) ---
      const dailyGrowth = [];
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 55; i >= 0; i--) {
        const dayEnd = new Date(now.getTime() - i * msPerDay);
        const dayStart = new Date(dayEnd.getTime() - msPerDay);
        const count = allUsers.filter(function(row) {
          const createdAt = new Date(row[8]); // createdAt = col 8
          return createdAt >= dayStart && createdAt < dayEnd;
        }).length;
        dailyGrowth.push({
          date: months[dayStart.getMonth()] + ' ' + dayStart.getDate(),
          count: count
        });
      }

      // --- Cumulative member count per week ---
      const cumulativeGrowth = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * msPerWeek);
        const count = allUsers.filter(function(row) {
          return new Date(row[8]) < weekEnd; // createdAt = col 8
        }).length;
        cumulativeGrowth.push({ label: weeklyGrowth[7 - i].label, count: count });
      }

      // --- Referral Performance (no referralCode column in DB, kept empty) ---
      const referralLeaderboard = [];
      const totalReferred = 0;

      // Monthly referrals (no referralCode column — kept empty arrays)
      const monthlyReferrals = [];
      const monthlyLeaderboards = {};

      // --- Birthday ---
      const todayMonth = now.getMonth() + 1; // 1-indexed
      const todayDay = now.getDate();

      var birthdayToday = [];
      var birthdayThisMonth = [];

      allUsers.forEach(function(row) {
        // birthDate = col 5. Use formatDate() to handle Date objects stored by Sheets.
        const rawBirth = formatDate(row[5]).trim(); // birthDate = col 5
        if (!rawBirth) return;

        // birthDate stored as YYYY-MM-DD or DD/MM/YYYY or similar
        var bMonth = null, bDay = null;
        // Try YYYY-MM-DD
        var isoMatch = rawBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
          bMonth = parseInt(isoMatch[2]);
          bDay = parseInt(isoMatch[3]);
        } else {
          // Try DD/MM/YYYY or DD-MM-YYYY
          var dmyMatch = rawBirth.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            bDay = parseInt(dmyMatch[1]);
            bMonth = parseInt(dmyMatch[2]);
          }
        }

        if (!bMonth || !bDay) return;

        const person = {
          id: row[0],
          name: row[1],
          phone: row[3],
          birthDate: rawBirth,
          birthDay: bDay,
          birthMonth: bMonth
        };

        if (bMonth === todayMonth && bDay === todayDay) {
          birthdayToday.push(person);
        }
        if (bMonth === todayMonth) {
          birthdayThisMonth.push(person);
        }
      });

      // Sort this-month birthdays by day
      birthdayThisMonth.sort(function(a, b) { return a.birthDay - b.birthDay; });

      // --- Vouchers ---
      let activeVoucherCount = 0;
      let redeemedVoucherCount = 0;
      let expiredVoucherCount = 0;
      let topVouchers = {};

      try {
        const vSheet = doc.getSheetByName('Vouchers');
        if (vSheet) {
          const vouchers = vSheet.getDataRange().getValues().slice(1);
          vouchers.forEach(function(row) {
            const status = String(row[7]);
            const rewardName = String(row[3]);
            if (status === 'active') activeVoucherCount++;
            else if (status === 'redeemed') redeemedVoucherCount++;
            else if (status === 'expired') expiredVoucherCount++;

            if (!topVouchers[rewardName]) {
               topVouchers[rewardName] = { active: 0, redeemed: 0, expired: 0 };
            }
            if (status === 'active') topVouchers[rewardName].active++;
            else if (status === 'redeemed') topVouchers[rewardName].redeemed++;
            else if (status === 'expired') topVouchers[rewardName].expired++;
          });
        }
      } catch(e) {}

      const voucherStats = Object.keys(topVouchers).map(function(name) {
         return {
           name: name,
           active: topVouchers[name].active,
           redeemed: topVouchers[name].redeemed,
           expired: topVouchers[name].expired,
           total: topVouchers[name].active + topVouchers[name].redeemed + topVouchers[name].expired
         };
      }).sort(function(a, b) { return b.total - a.total; });

      result = {
        success: true,
        data: {
          totalMembers: totalMembers,
          atRiskCount: atRiskUsers.length,
          newActiveCount: newActiveCount,
          veteranActiveCount: veteranActiveCount,
          weeklyGrowth: weeklyGrowth,
          dailyGrowth: dailyGrowth,
          cumulativeGrowth: cumulativeGrowth,
          atRiskUsers: atRiskUsers.slice(0, 50),
          referralLeaderboard: referralLeaderboard,
          totalReferred: totalReferred,
          monthlyReferrals: monthlyReferrals,
          monthlyLeaderboards: monthlyLeaderboards,
          birthdayToday: birthdayToday,
          birthdayThisMonth: birthdayThisMonth,
          activeVoucherCount: activeVoucherCount,
          redeemedVoucherCount: redeemedVoucherCount,
          expiredVoucherCount: expiredVoucherCount,
          voucherStats: voucherStats
        }
      };
    }

    // Get admin list
    else if (action === 'getAdminList') {
      const adminSheet = getOrCreateSheet(doc, 'AdminList', ['id', 'name', 'code']);
      const allRows = adminSheet.getDataRange().getValues().slice(1);
      const admins = allRows
        .filter(function(row) { return String(row[0]).trim() !== ''; })
        .map(function(row) {
          return {
            id: String(row[0]),
            name: String(row[1]),
            code: String(row[2])
          };
        });
      result = { success: true, admins: admins };
    }

    // Save admin list
    else if (action === 'saveAdminList') {
      const adminSheet = getOrCreateSheet(doc, 'AdminList', ['id', 'name', 'code']);
      const admins = requestData.admins || [];

      // Clear existing data (except header)
      if (adminSheet.getLastRow() > 1) {
        adminSheet.deleteRows(2, adminSheet.getLastRow() - 1);
      }

      // Append each admin
      admins.forEach(function(admin) {
        adminSheet.appendRow([
          admin.id || 'admin-' + new Date().getTime(),
          String(admin.name || '').trim(),
          String(admin.code || '').trim()
        ]);
      });
      SpreadsheetApp.flush();

      result = { success: true, admins: admins };
    }

    // Get all transactions (for admin download logs)
    else if (action === 'getTransactions') {
      const allUsers = usersSheet.getDataRange().getValues().slice(1);
      // Build a map of userId -> userName for enrichment
      const userMap = {};
      allUsers.forEach(function(row) {
        userMap[String(row[0])] = String(row[1]);
      });

      const allTx = txSheet.getDataRange().getValues().slice(1);
      allTx.sort(function(a, b) { return b[4] - a[4]; }); // newest first

      // Fetch Vouchers for reward names
      let voucherMap = {};
      try {
        const vSheet = doc.getSheetByName('Vouchers');
        if (vSheet) {
          const allVouchers = vSheet.getDataRange().getValues().slice(1);
          allVouchers.forEach(v => {
            const vUserId = String(v[1]);
            const ts = new Date(v[4]).getTime();
            if (!voucherMap[vUserId]) voucherMap[vUserId] = {};
            voucherMap[vUserId][ts] = String(v[3]);
          });
        }
      } catch (e) {}

      const transactions = allTx.map(function(r) {
        const txType = r[2];
        const txTs = Number(r[4]);
        const txUserId = String(r[1]);
        let rewardName = null;

        if ((txType === 'voucher_earned' || txType === 'voucher_redeemed') && voucherMap[txUserId]) {
          const closest = Object.keys(voucherMap[txUserId]).find(vTs => Math.abs(Number(vTs) - txTs) < 10000);
          if (closest) rewardName = voucherMap[txUserId][closest];
        }

        return {
          id: r[0],
          userId: txUserId,
          userName: userMap[txUserId] || '',
          type: txType,
          amount: Number(r[3]),
          timestamp: txTs,
          dateString: r[5],
          rewardName: rewardName
        };
      });

      result = { success: true, transactions: transactions };
    }

    // Reset stamps to 0 (after reward redemption)
    else if (action === 'resetStamps') {
      const userId = requestData.userId;
      const allUsers = usersSheet.getDataRange().getValues();
      const userIndex = allUsers.slice(1).findIndex(r => String(r[0]) === String(userId));

      if (userIndex === -1) {
        result = { success: false, error: "User not found." };
      } else {
        const realRow = userIndex + 2;
        usersSheet.getRange(realRow, 7).setValue(0); // reset currentStamps (col 7, 1-indexed)
        const now = new Date();
        txSheet.appendRow(['tx-' + now.getTime(), userId, 'reset', 0, now.getTime(), now.toISOString()]);
        SpreadsheetApp.flush();

        const updatedRow = [...allUsers[userIndex + 1]];
        updatedRow[6] = 0; // currentStamps index in row
        const history = getTransactionsForUser(txSheet, doc, userId);
        result = { success: true, user: mapRowToUser(updatedRow, history) };
      }
    }


    else {
      result = { success: false, error: "Unknown action" };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
      var y = val.getFullYear();
      var m = ('0' + (val.getMonth() + 1)).slice(-2);
      var d = ('0' + val.getDate()).slice(-2);
      return y + '-' + m + '-' + d;
  }
  return String(val).trim();
}

function getOrCreateSheet(doc, name, headers) {
  let sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    
    // CheckpointConfig sheet starts empty — config must be set via admin panel or directly in the sheet
    // AdminList starts empty — admins are added via the admin panel
  }
  return sheet;
}

function getTransactionsForUser(sheet, doc, userId) {
  const allTx = sheet.getDataRange().getValues().slice(1);
  const userTx = allTx.filter(r => String(r[1]) === String(userId));
  userTx.sort((a, b) => b[4] - a[4]);

  // Build voucher map for this user: timestamp (ms) -> rewardName
  // We'll match by finding the voucher whose createdAt is within 5s of the tx timestamp
  let voucherMap = {};
  try {
    const vSheet = doc.getSheetByName('Vouchers');
    if (vSheet) {
      const allVouchers = vSheet.getDataRange().getValues().slice(1);
      allVouchers
        .filter(v => String(v[1]) === String(userId))
        .forEach(v => {
          const ts = new Date(v[4]).getTime(); // createdAt
          voucherMap[ts] = { rewardName: String(v[3]), stampCount: parseInt(v[2]) };
        });
    }
  } catch(e) {}

  return userTx.map(r => {
    const txType = r[2];
    const txTs = Number(r[4]);
    let rewardName = null;

    if (txType === 'voucher_earned' || txType === 'voucher_redeemed') {
      // Find closest voucher within 10 seconds of this transaction
      const closest = Object.keys(voucherMap).find(vTs => Math.abs(Number(vTs) - txTs) < 10000);
      if (closest) rewardName = voucherMap[closest].rewardName;
    }

    return {
      id: r[0],
      timestamp: txTs,
      type: txType,
      amount: Number(r[3]),
      rewardName: rewardName
    };
  });
}


function mapRowToUser(row, history) {
  return {
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4],
    birthDate: formatDate(row[5]),        // birthDate = col 5
    stamps: parseInt(row[6] || 0),        // currentStamps = col 6
    maxStamps: parseInt(row[7] || 10),    // maxStamps = col 7
    createdAt: row[8] || new Date().toISOString(), // createdAt = col 8
    history: history
  };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ========== VOUCHER HELPER FUNCTIONS ==========

/**
 * Check if a stamp count is a checkpoint
 */
function checkIfCheckpoint(stampCount, checkpointConfig) {
  if (!checkpointConfig || !checkpointConfig.checkpoints) return null;
  const checkpoint = checkpointConfig.checkpoints.find(cp => cp.stampCount === stampCount);
  return checkpoint || null;
}

/**
 * Generate a voucher for a user when they reach a checkpoint
 */
function generateVoucher(doc, userId, stampCount, rewardName) {
  const vouchersSheet = getOrCreateSheet(doc, 'Vouchers', [
    'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
  ]);
  
  const now = new Date();
  const expiresAt = calculateExpiryDate(now, 30); // 30 days expiry
  const voucherId = 'voucher-' + now.getTime() + '-' + Math.random().toString(36).substr(2, 9);
  
  const voucherRow = [
    voucherId,
    userId,
    stampCount,
    rewardName,
    now.toISOString(),
    expiresAt.toISOString(),
    '', // redeemedAt - empty initially
    'active'
  ];
  
  vouchersSheet.appendRow(voucherRow);
  
  // Log transaction
  const txSheet = getOrCreateSheet(doc, 'Transactions', [
    'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
  ]);
  txSheet.appendRow([
    'tx-' + now.getTime(),
    userId,
    'voucher_earned',
    1,
    now.getTime(),
    now.toISOString()
  ]);
  
  SpreadsheetApp.flush();
  
  return {
    id: voucherId,
    userId: userId,
    checkpointStampCount: stampCount,
    rewardName: rewardName,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    redeemedAt: null,
    status: 'active'
  };
}

/**
 * Calculate expiry date (default 30 days from now)
 */
function calculateExpiryDate(fromDate, days) {
  const expiry = new Date(fromDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Get checkpoint configuration
 */
function getCheckpointConfiguration(doc) {
  const configSheet = getOrCreateSheet(doc, 'CheckpointConfig', ['maxStamps', 'checkpoints']);
  const data = configSheet.getDataRange().getValues();
  
  if (data.length < 2) {
    // No config in sheet — return empty checkpoints
    return { maxStamps: 10, checkpoints: [] };
  }
  
  const maxStamps = parseInt(data[1][0]) || 10;
  let checkpoints = [];
  try {
    checkpoints = JSON.parse(data[1][1] || '[]');
  } catch (e) {
    checkpoints = [];
  }
  
  return { maxStamps, checkpoints };
}
