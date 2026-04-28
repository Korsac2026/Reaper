



document.addEventListener('DOMContentLoaded', function () {
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    itemsPerPageSelect.value = '10';
});

document.addEventListener('DOMContentLoaded', function () {
    let allLicenses = [];
    let currentPage = 1;
    let itemsPerPage = 10;

    const itemsPerPageSelect = document.getElementById('itemsPerPage');

    itemsPerPageSelect.addEventListener('change', function() {
        itemsPerPage = parseInt(this.value);
        currentPage = 1;
        renderLicenses();
    });

    fetch('/api/licenses', {
        credentials: "include",
    })
        .then(response => response.json())
        .then(licenses => {
            allLicenses = licenses.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
            renderLicenses();
        })
        .catch(error => console.error('Error fetching licenses:', error));

    function renderLicenses() {
        const tableBody = document.querySelector('table.data-table tbody');
        tableBody.innerHTML = '';

        const totalPages = Math.ceil(allLicenses.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, allLicenses.length);

        const paginationCountInfo = document.querySelector('.pagination-count-info') || document.createElement('div');
        paginationCountInfo.className = 'pagination-count-info';
        paginationCountInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${allLicenses.length} licenses`;

        const currentLicenses = allLicenses.slice(startIndex, endIndex);

        currentLicenses.forEach(license => {
            const row = document.createElement('tr');

            const licenseKeyCell = document.createElement('td');
            licenseKeyCell.classList.add('license-key-container');

            const licenseKeySpan = document.createElement('span');
            licenseKeySpan.classList.add('license-key');
            licenseKeySpan.textContent = license.licenseKey;

            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-button');
            copyButton.setAttribute('title', 'Copy to clipboard');
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>`;

            copyButton.addEventListener('click', (e) => {
                e.preventDefault();
                navigator.clipboard.writeText(license.licenseKey)
                    .then(() => {
                        copyButton.setAttribute('title', 'Copied!');
                        copyButton.classList.add('copy-animation');

                        setTimeout(() => {
                            copyButton.classList.remove('copy-animation');
                            copyButton.setAttribute('title', 'Copy to clipboard');
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy: ', err);
                    });
            });

            licenseKeyCell.appendChild(licenseKeySpan);
            licenseKeyCell.appendChild(copyButton);

            row.appendChild(licenseKeyCell);

            const statusCell = document.createElement('td');
            statusCell.textContent = license.used ? 'Used' : 'Unused';
            row.appendChild(statusCell);

            const createdCell = document.createElement('td');
            const createdDate = new Date(license.creationDate);
            const createdDateFormatted = createdDate.toISOString().split('T');
            createdCell.textContent = `${createdDateFormatted[0]} ${createdDateFormatted[1].split('.')[0]}`;
            row.appendChild(createdCell);

            const expiresCell = document.createElement('td');
            let expiresText = 'Never';

            if (license.expiry > 0) {
                const ms = license.expiry;

                const ONE_MINUTE = 60 * 1000;
                const ONE_HOUR = 60 * ONE_MINUTE;
                const ONE_DAY = 24 * ONE_HOUR;
                const ONE_MONTH = 30.44 * ONE_DAY;
                const ONE_YEAR = 365.25 * ONE_DAY;

                if (ms >= ONE_YEAR && ms % ONE_YEAR === 0) {
                    const years = Math.round(ms / ONE_YEAR);
                    expiresText = `${years} year${years !== 1 ? 's' : ''}`;
                } else if (ms >= ONE_MONTH && ms % ONE_MONTH === 0) {
                    const months = Math.round(ms / ONE_MONTH);
                    expiresText = `${months} month${months !== 1 ? 's' : ''}`;
                } else if (ms >= ONE_DAY && ms % ONE_DAY === 0) {
                    const days = Math.round(ms / ONE_DAY);
                    expiresText = `${days} day${days !== 1 ? 's' : ''}`;
                } else if (ms >= ONE_HOUR && ms % ONE_HOUR === 0) {
                    const hours = Math.round(ms / ONE_HOUR);
                    expiresText = `${hours} hour${hours !== 1 ? 's' : ''}`;
                } else if (ms >= ONE_MINUTE && ms % ONE_MINUTE === 0) {
                    const minutes = Math.round(ms / ONE_MINUTE);
                    expiresText = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                } else {
                    expiresText = `${ms} ms`;
                }
            }

            expiresCell.textContent = expiresText;
            row.appendChild(expiresCell);

            const notesCell = document.createElement('td');
            notesCell.textContent = (license.note && license.note.trim() !== '') ? license.note : "None";
            row.appendChild(notesCell);

            const actionsCell = document.createElement('td');
            actionsCell.innerHTML = `
                <div class="dropdown">
                    <button class="btn dropdown-toggle">Actions</button>
                    <div class="dropdown-menu">
                        <a href="#" class="dropdown-item extend-license">Extend</a>
                        <a href="#" class="dropdown-item change-note">Change Note</a>
                        <a href="#" class="dropdown-item delete-license">Delete</a>
                    </div>
                </div>
            `;
            row.appendChild(actionsCell);

            const extendButton = actionsCell.querySelector('.extend-license');
            extendButton.addEventListener('click', (e) => {
                e.preventDefault();
                extendLicense(license.licenseKey);
            });

            const changeNoteButton = actionsCell.querySelector('.change-note');
            changeNoteButton.addEventListener('click', (e) => {
                e.preventDefault();
                changeNote(license.licenseKey, license.note || '');
            });

            const deleteButton = actionsCell.querySelector('.delete-license');
            deleteButton.addEventListener('click', (e) => {
                e.preventDefault();
                deleteLicense(license.licenseKey);
            });

            tableBody.appendChild(row);
        });

        updatePaginationControls(totalPages, paginationCountInfo);
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
            renderLicenses();
        });
        firstButton.classList.add('pagination-first');
        paginationContainer.appendChild(firstButton);

        const prevButton = createPaginationButton('Prev', currentPage > 1, () => {
            currentPage--;
            renderLicenses();
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
                renderLicenses();
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
            renderLicenses();
        });
        nextButton.classList.add('pagination-next');
        paginationContainer.appendChild(nextButton);

        const lastButton = createPaginationButton('Last', currentPage < totalPages, () => {
            currentPage = totalPages;
            renderLicenses();
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

    function extendLicense(licenseKey) {
        const extension = prompt("Enter number of hours to extend:", "24");

        if (extension !== null) {
            const data = {
                licenseKey: licenseKey,
                hours: parseInt(extension)
            };

            console.log("Sending request with data:", data);  // Log the data being sent

            fetch('/api/licenses/extend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify(data)
            })
                .then(response => {
                    return response.json();
                })
                .then(data => {

                    if (data.success) {
                        alert("Successfully extended the license.")
                        fetchLicenses();
                    } else {
                        alert('Failed to extend license: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('An error occurred while extending the license.');
                });
        }
    }

    function changeNote(licenseKey, currentNote) {
        const newNote = prompt("Enter new note:", currentNote);

        if (newNote !== null) {
            fetch('/api/licenses/note', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    licenseKey: licenseKey,
                    note: newNote
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert("Successfully changed the note.")
                        fetchLicenses();
                    } else {
                        alert('Failed to update note: ' + data.error);
                    }
                })
                .catch(error => {
                    console.error('Error updating note:', error);
                    alert('An error occurred while updating the note.');
                });
        }
    }

    function deleteLicense(licenseKey) {
        if (confirm(`Are you sure you want to delete license ${licenseKey}?`)) {
            fetch('/api/licenses/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    licenseKey: licenseKey
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert("Successfully deleted the license.")
                        fetchLicenses();
                    } else {
                        alert('Failed to delete license: ' + data.error);
                    }
                })
                .catch(error => {
                    console.error('Error deleting license:', error);
                    alert('An error occurred while deleting the license.');
                });
        }
    }

    document.getElementById('compensateAllKeysButton').addEventListener('click', function() {
        const extension = prompt("Enter number of hours to extend each license by:", "24");

        if (extension !== null) {
            const data = {
                hours: parseInt(extension)
            };

            fetch('/api/licenses/extendall', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify(data)
            })
                .then(response => {
                    return response.json();
                })
                .then(data => {

                    if (data.success) {
                        alert("Successfully extended every license.")
                        fetchLicenses();
                    } else {
                        alert('Failed to extend every license: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('An error occurred while extending every license.');
                });
        }
    });

    document.getElementById('deleteAllKeysBtn').addEventListener('click', function() {
        if (confirm(`Are you sure you want to delete every license?`)) {

            fetch('/api/licenses', {
                method: 'DELETE',
                credentials: "include",
            })
                .then(
                    setTimeout(() => {
                        successNotification.style.display = 'block';
                        setTimeout(() => {
                            successNotification.style.display = 'none';
                            location.reload();
                        }, 500);

                        closeModalFunction();
                    }, 100))
                .catch(error => {
                    console.error('Error:', error);
                    alert('Failed to delete all licenses');
                });
        }
    });

    document.getElementById('deleteAllUsedKeysBtn').addEventListener('click', function() {
        if (confirm(`Are you sure you want to delete every used license?`)) {
            fetch('/api/licenses/used', {
                method: 'DELETE',
                credentials: "include",
            })
                .then(
                    setTimeout(() => {
                        successNotification.style.display = 'block';
                        setTimeout(() => {
                            successNotification.style.display = 'none';
                            location.reload();
                        }, 500);

                        closeModalFunction();
                    }, 100)
                )
                .catch(error => {
                    console.error('Error:', error);
                    alert('Failed to delete used licenses');
                });
        }
    });

    document.getElementById('deleteAllUnusedKeysBtn').addEventListener('click', function() {
        if (confirm(`Are you sure you want to delete every unused license?`)) {
            fetch('/api/licenses/unused', {
                method: 'DELETE',
                credentials: "include",
            })
                .then(
                    setTimeout(() => {
                        successNotification.style.display = 'block';
                        setTimeout(() => {
                            successNotification.style.display = 'none';
                            location.reload();
                        }, 500);

                        closeModalFunction();
                    }, 100)
                )
                .catch(error => {
                    console.error('Error:', error);
                    alert('Failed to delete unused licenses');
                });
        }
    });

    function fetchLicenses() {
        fetch('/api/licenses', {
            credentials: "include",
        })
            .then(response => response.json())
            .then(licenses => {
                allLicenses = licenses.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
                renderLicenses();
            })
            .catch(error => console.error('Error fetching licenses:', error));
    }
});

