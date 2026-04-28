



let allUsers = [];
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('deleteAllUsersBtn').addEventListener('click', deleteAllUsers);
    document.getElementById('deleteAllExpiredUsersBtn').addEventListener('click', deleteAllExpiredUsers);
    document.getElementById('resetAllUsersHWIDBtn').addEventListener('click', resetAllUsersHWID);
    document.getElementById('unbanAllUsersBtn').addEventListener('click', unbanAllUsers);

    fetchUsers();
});

function deleteAllUsers() {
    if (confirm('Are you sure you want to delete ALL users? This action cannot be undone.')) {
        fetch('/api/users/all', {
            method: 'DELETE',
            credentials: 'include'
        })
            .then(response => {
                if (response.ok) {
                    fetchUsers();
                } else {
                    alert('Failed to delete all users');
                }
            })
            .catch(error => console.error('Error deleting all users:', error));
    }
}

function deleteAllExpiredUsers() {
    if (confirm('Are you sure you want to delete all expired users? This action cannot be undone.')) {
        fetch('/api/users/expired', {
            method: 'DELETE',
            credentials: 'include'
        })
            .then(response => {
                if (response.ok) {
                    fetchUsers();
                } else {
                    alert('Failed to delete expired users');
                }
            })
            .catch(error => console.error('Error deleting expired users:', error));
    }
}

function resetAllUsersHWID() {
    if (confirm('Are you sure you want to reset HWID for ALL users?')) {
        fetch('/api/users/hwid/reset', {
            method: 'PUT',
            credentials: 'include'
        })
            .then(response => {
                if (response.ok) {
                    fetchUsers();
                } else {
                    alert('Failed to reset all HWIDs');
                }
            })
            .catch(error => console.error('Error resetting all HWIDs:', error));
    }
}

function unbanAllUsers() {
    if (confirm('Are you sure you want to unban ALL users?')) {
        fetch('/api/users/unban/all', {
            method: 'PUT',
            credentials: 'include'
        })
            .then(response => {
                if (response.ok) {
                    fetchUsers();
                } else {
                    alert('Failed to unban all users');
                }
            })
            .catch(error => console.error('Error unbanning all users:', error));
    }
}

function renderUsers() {
    const tableBody = document.querySelector('#usersSection table.data-table tbody');
    tableBody.innerHTML = '';

    const totalPages = Math.ceil(allUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allUsers.length);

    let paginationDiv = document.querySelector('#usersSection .pagination');
    if (!paginationDiv) {
        paginationDiv = document.createElement('div');
        paginationDiv.className = 'user-pagination';
        document.querySelector('#usersSection .card').appendChild(paginationDiv);
    }

    const currentUsers = allUsers.slice(startIndex, endIndex);

    currentUsers.forEach(user => {
        const row = document.createElement('tr');

        const idCell = document.createElement('td');
        idCell.textContent = user.id;
        row.appendChild(idCell);

        const licenseKeyCell = document.createElement('td');
        licenseKeyCell.textContent = user.licenseKey;
        licenseKeyCell.classList.add('license-key');
        row.appendChild(licenseKeyCell);

        const hwidCell = document.createElement('td');
        if (user.hwid === "0") {
            hwidCell.textContent = "N/A";
        } else {
            hwidCell.textContent = user.hwid;
        }
        hwidCell.classList.add('blurred');
        row.appendChild(hwidCell);

        const ipCell = document.createElement('td');
        ipCell.textContent = user.ipv4;
        ipCell.classList.add('blurred');
        row.appendChild(ipCell);

        const createdCell = document.createElement('td');
        const createdDate = new Date(user.creationDate);
        createdCell.textContent = createdDate.toLocaleString();
        row.appendChild(createdCell);

        const lastLoginCell = document.createElement('td');
        if (user.lastLoginDate === 0) {
            lastLoginCell.textContent = "Never";
        } else {
            const lastLoginDate = new Date(user.lastLoginDate);
            lastLoginCell.textContent = lastLoginDate.toLocaleString();
        }
        row.appendChild(lastLoginCell);

        const expiryCell = document.createElement('td');
        const expiryDate = new Date(user.expiry);
        expiryCell.textContent = expiryDate.toLocaleString();
        row.appendChild(expiryCell);

        const bannedCell = document.createElement('td');
        bannedCell.textContent = user.banned ? 'Yes' : 'No';
        if (user.banned) {
            bannedCell.classList.add('banned-status');
        }
        row.appendChild(bannedCell);

        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <div class="dropdown">
                <button class="btn dropdown-toggle">Actions</button>
                <div class="dropdown-menu">
                    <a href="#" class="dropdown-item toggle-ban-status">${user.banned ? 'Unban User' : 'Ban User'}</a>
                    <a href="#" class="dropdown-item reset-hwid">Reset HWID</a>
                    <a href="#" class="dropdown-item delete-user">Delete</a>
                </div>
            </div>
        `;
        row.appendChild(actionsCell);

        const toggleBanButton = actionsCell.querySelector('.toggle-ban-status');
        toggleBanButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleBanStatus(user.id, user.banned);
        });

        const resetHwidButton = actionsCell.querySelector('.reset-hwid');
        resetHwidButton.addEventListener('click', (e) => {
            e.preventDefault();
            resetHwid(user.id);
        });

        const deleteButton = actionsCell.querySelector('.delete-user');
        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            deleteUser(user.id);
        });

        tableBody.appendChild(row);
    });

    updatePaginationControls(totalPages, paginationCountInfo, paginationDiv);
}

function toggleBanStatus(userId, currentStatus) {
    if (confirm(`Are you sure you want to ${currentStatus ? 'unban' : 'ban'} this user?`)) {
        fetch(`/api/users/toggleBan`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Successfully banned this user.")
                    fetchUsers();
                } else {
                    alert('Failed to ban this user: ' + data.error);
                }
            })
            .catch(error => console.error('Error toggling ban status:', error));
    }
}

function resetHwid(userId) {
    if (confirm('Are you sure you want to reset this user\'s HWID?')) {
        fetch(`/api/users/resetHwid`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Successfully reset this users hwid.")
                    fetchUsers();
                } else {
                    alert('Failed reset this users hwid: ' + data.error);
                }
            })
            .catch(error => console.error('Error resetting users hwid:', error));
    }
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        fetch(`/api/users`, {
            method: 'DELETE',
            credentials: 'include',
            body: JSON.stringify({
                userId: userId
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Successfully deleted this user.")
                    fetchUsers();
                } else {
                    alert('Failed to delete this user: ' + data.error);
                }
            })
            .catch(error => console.error('Error deleting user:', error));
    }
}

function updatePaginationControls(totalPages, countInfoElement) {
    let paginationContainer = document.querySelector('.pagination-controls');
    if (!paginationContainer) {
        const paginationDiv = document.querySelector('.pagination');

        if (!paginationDiv.contains(countInfoElement)) {
            paginationDiv.appendChild(countInfoElement);
        }

        paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls';
        paginationDiv.appendChild(paginationContainer);
    }

    paginationContainer.innerHTML = '';

    if (totalPages <= 1) {
        return;
    }

    const firstButton = createPaginationButton('First', currentPage > 1, () => {
        currentPage = 1;
        renderUsers();
    });
    firstButton.classList.add('pagination-first');
    paginationContainer.appendChild(firstButton);

    const prevButton = createPaginationButton('Prev', currentPage > 1, () => {
        currentPage--;
        renderUsers();
    });
    prevButton.classList.add('pagination-prev');
    paginationContainer.appendChild(prevButton);

    const maxVisibleButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    if (startPage > 1) {
        const ellipsisStart = document.createElement('span');
        ellipsisStart.className = 'pagination-ellipsis';
        ellipsisStart.textContent = '...';
        paginationContainer.appendChild(ellipsisStart);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = createPaginationButton(i.toString(), true, () => {
            currentPage = i;
            renderUsers();
        });
        pageButton.classList.add('pagination-number');

        if (i === currentPage) {
            pageButton.classList.add('pagination-current');
        }

        paginationContainer.appendChild(pageButton);
    }

    if (endPage < totalPages) {
        const ellipsisEnd = document.createElement('span');
        ellipsisEnd.className = 'pagination-ellipsis';
        ellipsisEnd.textContent = '...';
        paginationContainer.appendChild(ellipsisEnd);
    }

    const nextButton = createPaginationButton('Next', currentPage < totalPages, () => {
        currentPage++;
        renderUsers();
    });
    nextButton.classList.add('pagination-next');
    paginationContainer.appendChild(nextButton);

    const lastButton = createPaginationButton('Last', currentPage < totalPages, () => {
        currentPage = totalPages;
        renderUsers();
    });
    lastButton.classList.add('pagination-last');
    paginationContainer.appendChild(lastButton);
}

function createPaginationButton(text, enabled, onClick) {
    const button = document.createElement('button');
    button.className = 'pagination-button';
    button.textContent = text;
    button.disabled = !enabled;

    if (enabled) {
        button.addEventListener('click', onClick);
    }

    return button;
}

function fetchUsers() {
    fetch('/api/users', {
        credentials: "include",
    })
        .then(response => response.json())
        .then(users => {
            allUsers = users.sort((a, b) => new Date(b.lastLoginDate) - new Date(a.lastLoginDate));
            renderUsers();
        });
}

