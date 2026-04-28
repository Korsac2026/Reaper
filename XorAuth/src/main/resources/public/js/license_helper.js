



const licensesTab = document.getElementById('licensesTab');
const usersTab = document.getElementById('usersTab');
const settingsTab = document.getElementById('settingsTab');
const licensesSection = document.getElementById('licensesSection');
const usersSection = document.getElementById('usersSection');
const settingsSection = document.getElementById('settingsSection');

licensesTab.addEventListener('click', function(e) {
    e.preventDefault();
    licensesTab.classList.add('active');
    usersTab.classList.remove('active');
    settingsTab.classList.remove('active');
    licensesSection.style.display = 'block';
    usersSection.style.display = 'none';
    settingsSection.style.display = 'none';
});

usersTab.addEventListener('click', function(e) {
    e.preventDefault();
    usersTab.classList.add('active');
    licensesTab.classList.remove('active');
    settingsTab.classList.remove('active');
    usersSection.style.display = 'block';
    licensesSection.style.display = 'none';
    settingsSection.style.display = 'none';
});

settingsTab.addEventListener('click', function(e) {
    e.preventDefault();
    settingsTab.classList.add('active');
    licensesTab.classList.remove('active');
    usersTab.classList.remove('active');
    settingsSection.style.display = 'block';
    licensesSection.style.display = 'none';
    usersSection.style.display = 'none';
});

const modal = document.getElementById('generateLicenseModal');
const generateBtn = document.querySelector('.btn-primary');
const closeModal = document.querySelector('.close-modal');
const closeModalBtn = document.querySelector('.close-modal-btn');
const successNotification = document.getElementById('successNotification');
const licenseGenerationForm = document.getElementById('licenseGenerationForm');

const expirationType = document.getElementById('expirationType');
const durationExpiration = document.getElementById('durationExpiration');
const dateExpiration = document.getElementById('dateExpiration');

const licenseAmount = document.getElementById('licenseAmount');
const licenseMask = document.getElementById('licenseMask');
const expirationDate = document.getElementById('expirationDate');

const amountError = document.getElementById('amountError');
const maskError = document.getElementById('maskError');
const dateError = document.getElementById('dateError');

generateBtn.addEventListener('click', function() {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    expirationDate.valueAsDate = thirtyDaysFromNow;
});

function closeModalFunction() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    licenseGenerationForm.reset();
    resetErrors();
}

closeModal.addEventListener('click', closeModalFunction);
closeModalBtn.addEventListener('click', closeModalFunction);

window.addEventListener('click', function(event) {
    if (event.target === modal) {
        closeModalFunction();
    }
});

expirationType.addEventListener('change', function() {
    if (this.value === 'duration') {
        durationExpiration.style.display = 'block';
        dateExpiration.style.display = 'none';
    } else if (this.value === 'date') {
        durationExpiration.style.display = 'none';
        dateExpiration.style.display = 'block';
    } else {
        durationExpiration.style.display = 'none';
        dateExpiration.style.display = 'none';
    }
});

function resetErrors() {
    amountError.textContent = '';
    maskError.textContent = '';
    dateError.textContent = '';

    licenseAmount.classList.remove('error');
    licenseMask.classList.remove('error');
    expirationDate.classList.remove('error');
}

function validateForm() {
    resetErrors();
    let isValid = true;

    if (licenseAmount.value < 1 || licenseAmount.value > 100) {
        amountError.textContent = 'Amount must be between 1 and 100';
        licenseAmount.classList.add('error');
        isValid = false;
    }

    const maskPattern = /^[A-X0-9-]+$/;
    if (!maskPattern.test(licenseMask.value)) {
        maskError.textContent = 'Invalid mask format';
        licenseMask.classList.add('error');
        isValid = false;
    }

    if (expirationType.value === 'date') {
        const selectedDate = new Date(expirationDate.value);
        const today = new Date();

        if (!expirationDate.value) {
            dateError.textContent = 'Please select an expiration date';
            expirationDate.classList.add('error');
            isValid = false;
        } else if (selectedDate <= today) {
            dateError.textContent = 'Date must be in the future';
            expirationDate.classList.add('error');
            isValid = false;
        }
    }

    return isValid;
}

licenseGenerationForm.addEventListener('submit', function(e) {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    const submitButton = this.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Generating...';
    submitButton.disabled = true;

    const formData = {
        amount: licenseAmount.value,
        prefix: document.getElementById('batchPrefix').value,
        mask: licenseMask.value,
        expirationType: expirationType.value,
        expirationValue: document.getElementById('expirationValue').value,
        expirationUnit: document.getElementById('expirationUnit').value,
        expirationDate: expirationDate.value,
        notes: document.getElementById('licenseNotes').value
    };

    let expiryTimestamp = 0;

    if (formData.expirationType === 'date') {
        const selectedDate = new Date(formData.expirationDate);
        const now = Date.now();
        const duration = selectedDate.getTime() - now;
        expiryTimestamp = duration > 0 ? duration : 0;
    } else if (formData.expirationType === 'duration') {
        const value = parseInt(formData.expirationValue, 10);
        const unit = formData.expirationUnit;

        switch (unit) {
            case 'hours':
                expiryTimestamp = value * 60 * 60 * 1000;
                break;
            case 'days':
                expiryTimestamp = value * 24 * 60 * 60 * 1000;
                break;
            case 'months':
                expiryTimestamp = value * 30.44 * 24 * 60 * 60 * 1000;
                break;
            case 'years':
                expiryTimestamp = value * 365.25 * 24 * 60 * 60 * 1000;
                break;
        }
    }

    formData.expiryTimestamp = expiryTimestamp;

    setTimeout(() => {
        console.log(expiryTimestamp);
        successNotification.style.display = 'block';
        setTimeout(() => {
            successNotification.style.display = 'none';
            location.reload();
        }, 500);

        submitButton.textContent = originalText;
        submitButton.disabled = false;
        closeModalFunction();
    }, 100);

    fetch('/api/licenses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify(formData)
    })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to generate licenses: ' + error.message);

            submitButton.textContent = originalText;
            submitButton.disabled = false;
        });
});